//! MI-FORK: «Abrir con ▸» para carpetas.
//!
//! Windows no tiene «Abrir con» para carpetas (el verb "openas" es solo para
//! archivos), así que el submenú lo arma el frontend con los editores que
//! abren una carpeta como proyecto (`app.exe "<carpeta>"`) más los .exe que
//! el usuario elija a mano (src/mi-fork/folderApps.ts los guarda).

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::{AppError, CmdResult};

#[derive(Serialize)]
pub struct FolderApp {
    name: String,
    path: String,
}

/// (nombre, variable de entorno con la carpeta base, ruta relativa al .exe).
/// El primero que exista de cada nombre gana (instalación de usuario antes que la global).
const KNOWN: &[(&str, &str, &str)] = &[
    ("Visual Studio Code", "LOCALAPPDATA", r"Programs\Microsoft VS Code\Code.exe"),
    ("Visual Studio Code", "ProgramFiles", r"Microsoft VS Code\Code.exe"),
    ("VS Code Insiders", "LOCALAPPDATA", r"Programs\Microsoft VS Code Insiders\Code - Insiders.exe"),
    ("Cursor", "LOCALAPPDATA", r"Programs\cursor\Cursor.exe"),
    ("Windsurf", "LOCALAPPDATA", r"Programs\Windsurf\Windsurf.exe"),
    ("Zed", "LOCALAPPDATA", r"Programs\Zed\Zed.exe"),
    ("Sublime Text", "ProgramFiles", r"Sublime Text\sublime_text.exe"),
];

#[tauri::command(async)]
pub fn folder_apps() -> Vec<FolderApp> {
    let mut found: Vec<FolderApp> = Vec::new();
    for (name, base, relative) in KNOWN {
        let Some(base) = std::env::var_os(base) else { continue };
        let path = PathBuf::from(base).join(relative);
        if path.is_file() && !found.iter().any(|app| app.name == *name) {
            found.push(FolderApp { name: name.to_string(), path: path.to_string_lossy().into_owned() });
        }
    }
    found
}

#[tauri::command(async)]
pub fn open_folder_with(app: String, path: String) -> CmdResult<()> {
    if !Path::new(&app).is_file() {
        return Err(AppError::at(&app, AppError::new("error.notFound")));
    }
    if !Path::new(&path).is_dir() {
        return Err(AppError::at(&path, AppError::new("error.notFound")));
    }
    // `C:\` entre comillas: la barra final escaparía la comilla de cierre.
    let quoted = if path.ends_with('\\') { format!("\"{path}\\\"") } else { format!("\"{path}\"") };
    crate::shell_execute("open", std::ffi::OsStr::new(&app), Some(&quoted), Some(Path::new(&path)))
        .map_err(|code| AppError::new("error.openFolderWith").arg("code", code.to_string()))
}

/// Diálogo de Windows para elegir un .exe. None = el usuario canceló.
#[tauri::command(async)]
pub fn pick_folder_app(window: tauri::WebviewWindow, title: String, filter: String) -> CmdResult<Option<FolderApp>> {
    #[cfg(windows)]
    {
        let owner = crate::fileop::owner_of(&window);
        let picked = std::thread::spawn(move || pick_exe(owner, &title, &filter))
            .join()
            .map_err(|_| AppError::raw("pick_folder_app panicked"))?
            .map_err(AppError::raw)?;
        Ok(picked.map(|path| FolderApp {
            name: Path::new(&path).file_stem().map_or_else(|| path.clone(), |stem| stem.to_string_lossy().into_owned()),
            path,
        }))
    }
    #[cfg(not(windows))]
    {
        let _ = (window, title, filter);
        Err(AppError::new("error.windowsOnly"))
    }
}

/// IFileOpenDialog en su propio hilo STA, con la ventana de la app como dueña.
#[cfg(windows)]
fn pick_exe(owner: isize, title: &str, filter: &str) -> windows::core::Result<Option<String>> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::Foundation::{ERROR_CANCELLED, HWND};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::Common::COMDLG_FILTERSPEC;
    use windows::Win32::UI::Shell::{FileOpenDialog, IFileOpenDialog, FOS_FILEMUSTEXIST, FOS_FORCEFILESYSTEM, SIGDN_FILESYSPATH};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let result = (|| {
            let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)?;
            let name = HSTRING::from(format!("{filter} (*.exe)"));
            let spec = HSTRING::from("*.exe");
            dialog.SetFileTypes(&[COMDLG_FILTERSPEC { pszName: PCWSTR(name.as_ptr()), pszSpec: PCWSTR(spec.as_ptr()) }])?;
            dialog.SetTitle(&HSTRING::from(title))?;
            dialog.SetOptions(dialog.GetOptions()? | FOS_FILEMUSTEXIST | FOS_FORCEFILESYSTEM)?;
            if let Err(err) = dialog.Show(Some(HWND(owner as _))) {
                return if err.code() == ERROR_CANCELLED.to_hresult() { Ok(None) } else { Err(err) };
            }
            let raw = dialog.GetResult()?.GetDisplayName(SIGDN_FILESYSPATH)?;
            let path = raw.to_string();
            CoTaskMemFree(Some(raw.0 as _));
            Ok(path.ok())
        })();
        CoUninitialize();
        result
    }
}

// ---------------------------------------------------------------------------
// Lista de saltos (clic derecho en el icono de la barra de tareas): categoría
// «Recientes» con las últimas carpetas abiertas. Cada entrada lanza
// `dirwise.exe "<carpeta>"`; si la app ya está abierta, tauri-plugin-single-
// instance pasa los argumentos a la ventana existente (`second_instance`) y la
// carpeta se abre ahí como pestaña nueva (src/mi-fork/jumpList.ts).
// ---------------------------------------------------------------------------

/// Primera carpeta entre los argumentos (sin el .exe).
fn folder_arg<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter().skip(1).find(|arg| Path::new(arg).is_dir())
}

/// Carpeta pasada al arrancar; se entrega una sola vez (un reload no la repite).
#[tauri::command(async)]
pub fn startup_folder() -> Option<String> {
    static TAKEN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if TAKEN.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return None;
    }
    folder_arg(std::env::args())
}

/// Callback de tauri-plugin-single-instance: otra instancia arrancó con `argv`.
pub fn second_instance(app: &tauri::AppHandle, argv: Vec<String>) {
    use tauri::{Emitter, Manager};
    let Some(window) = app.get_webview_window("main") else { return };
    if let Some(path) = folder_arg(argv) {
        let _ = window.emit("mi-open-folder", path);
    }
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command(async)]
pub fn set_jump_list(category: String, paths: Vec<String>) -> CmdResult<()> {
    #[cfg(windows)]
    {
        std::thread::spawn(move || write_jump_list(&category, &paths))
            .join()
            .map_err(|_| AppError::raw("set_jump_list panicked"))?
            .map_err(AppError::raw)
    }
    #[cfg(not(windows))]
    {
        let _ = (category, paths);
        Ok(())
    }
}

#[cfg(windows)]
fn write_jump_list(category: &str, paths: &[String]) -> windows::core::Result<()> {
    use windows::core::{Interface, HSTRING};
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows::Win32::Storage::EnhancedStorage::PKEY_Title;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
    use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
    use windows::Win32::UI::Shell::{DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW, ShellLink};

    let exe = std::env::current_exe().map_err(|err| windows::core::Error::new(windows::core::HRESULT(-1), err.to_string()))?;
    let icons = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into()) + r"\System32\imageres.dll";

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let result = (|| {
            let list: ICustomDestinationList = CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)?;
            let mut slots = 0u32;
            let removed: IObjectArray = list.BeginList(&mut slots)?;

            // Lo que el usuario quitó de la lista («Quitar de esta lista») no se
            // puede volver a añadir — AppendCategory fallaría entera.
            let mut blocked = Vec::new();
            for index in 0..removed.GetCount()? {
                let Ok(link) = removed.GetAt::<IShellLinkW>(index) else { continue };
                let mut args = [0u16; 1024];
                if link.GetArguments(&mut args).is_ok() {
                    let len = args.iter().position(|&c| c == 0).unwrap_or(args.len());
                    blocked.push(String::from_utf16_lossy(&args[..len]).to_lowercase());
                }
            }

            let items: IObjectCollection = CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)?;
            let mut count = 0;
            for path in paths {
                if count >= slots as usize {
                    break;
                }
                let quoted = if path.ends_with('\\') { format!("\"{path}\\\"") } else { format!("\"{path}\"") };
                if blocked.contains(&quoted.to_lowercase()) {
                    continue;
                }
                let title = Path::new(path).file_name().map_or_else(|| path.clone(), |name| name.to_string_lossy().into_owned());
                let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
                link.SetPath(&HSTRING::from(exe.as_os_str()))?;
                link.SetArguments(&HSTRING::from(quoted))?;
                link.SetDescription(&HSTRING::from(path.as_str()))?;
                // imageres.dll #3 = icono de carpeta de Windows.
                link.SetIconLocation(&HSTRING::from(icons.as_str()), 3)?;
                let store: IPropertyStore = link.cast()?;
                store.SetValue(&PKEY_Title, &PROPVARIANT::from(title.as_str()))?;
                store.Commit()?;
                items.AddObject(&link)?;
                count += 1;
            }

            if count > 0 {
                list.AppendCategory(&HSTRING::from(category), &items.cast::<IObjectArray>()?)?;
            }
            list.CommitList()
        })();
        CoUninitialize();
        result
    }
}
