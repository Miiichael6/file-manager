//! MI-FORK: línea de comandos e integración con Windows (PENDIENTES §6).
//!
//! `file-manager.exe [--new-window] [--select] <ruta>`:
//! - carpeta → se abre en una pestaña nueva; archivo → se abre su carpeta con
//!   el archivo seleccionado; `--select` hace lo mismo también con una carpeta;
//! - rutas relativas (`.`, `..\docs`) se resuelven contra la carpeta de quien
//!   lanzó el comando — con la app ya abierta llega en `second_instance`;
//! - `--new-window` abre una ventana (proceso) aparte en vez de reenviar la ruta
//!   a la instancia abierta (main.rs no registra single-instance);
//! - `--unregister` quita el PATH y el menú del Explorador y sale (lo llama el
//!   desinstalador, nsis/mi-hooks.nsh).
//!
//! La integración (carpeta del .exe en el PATH de usuario, «Abrir en File
//! Manager» en el menú contextual del Explorador) vive en HKCU, sin admin.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::{AppError, CmdResult};

#[derive(Serialize, Clone)]
pub struct Launch {
    /// Carpeta que abrir en una pestaña nueva.
    path: String,
    /// Elemento que seleccionar dentro de ella.
    select: Option<String>,
}

pub fn wants_new_window() -> bool {
    std::env::args().skip(1).any(|arg| arg.eq_ignore_ascii_case("--new-window"))
}

/// `\\?\C:\x` → `C:\x`, `\\?\UNC\srv\x` → `\\srv\x` (lo que deja canonicalize).
fn plain(path: &Path) -> String {
    let text = path.to_string_lossy();
    match text.strip_prefix(r"\\?\") {
        Some(rest) => rest.strip_prefix(r"UNC\").map_or_else(|| rest.to_string(), |unc| format!(r"\\{unc}")),
        None => text.into_owned(),
    }
}

fn parse<I: IntoIterator<Item = String>>(args: I, cwd: &Path) -> Option<Launch> {
    let mut select = false;
    let mut target = None;
    for arg in args.into_iter().skip(1) {
        if arg.eq_ignore_ascii_case("--select") {
            select = true;
            continue;
        }
        if arg.starts_with("--") {
            continue;
        }
        // `"C:\ruta\"` llega desde cmd/PowerShell con la comilla final pegada (la barra la escapa).
        let mut arg = arg.trim_end_matches('"').to_string();
        if arg.len() == 2 && arg.ends_with(':') {
            arg.push('\\');
        }
        if let Ok(path) = std::fs::canonicalize(cwd.join(&arg)) {
            target = Some(path);
            break;
        }
    }
    let target = target?;
    match target.parent() {
        Some(parent) if select || !target.is_dir() => {
            Some(Launch { path: plain(parent), select: Some(plain(&target)) })
        }
        _ => Some(Launch { path: plain(&target), select: None }),
    }
}

/// Ruta pasada al arrancar; se entrega una sola vez (un reload no la repite).
#[tauri::command(async)]
pub fn startup_launch() -> Option<Launch> {
    static TAKEN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if TAKEN.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return None;
    }
    parse(std::env::args(), &std::env::current_dir().ok()?)
}

/// Callback de tauri-plugin-single-instance: otra instancia arrancó con `argv` en `cwd`.
pub fn second_instance(app: &tauri::AppHandle, argv: Vec<String>, cwd: String) {
    use tauri::{Emitter, Manager};
    let Some(window) = app.get_webview_window("main") else { return };
    if let Some(launch) = parse(argv, Path::new(&cwd)) {
        let _ = window.emit("mi-open-folder", launch);
    }
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

// ---------------------------------------------------------------------------
// Integración con Windows (HKCU)
// ---------------------------------------------------------------------------

/// Claves del menú contextual: sobre una carpeta, en el fondo de una carpeta y sobre una unidad.
const MENU_KEYS: [&str; 3] = [
    r"Software\Classes\Directory\shell\MiFileManager",
    r"Software\Classes\Directory\Background\shell\MiFileManager",
    r"Software\Classes\Drive\shell\MiFileManager",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Integration {
    path: bool,
    context_menu: bool,
}

fn exe() -> CmdResult<PathBuf> {
    std::env::current_exe().map_err(|err| AppError::raw(err.to_string()))
}

fn exe_dir() -> CmdResult<String> {
    Ok(exe()?.parent().map(plain).unwrap_or_default())
}

#[tauri::command(async)]
pub fn shell_integration() -> CmdResult<Integration> {
    let dir = exe_dir()?;
    Ok(Integration {
        path: reg::user_path().iter().any(|entry| same_dir(entry, &dir)),
        context_menu: reg::exists(MENU_KEYS[0]),
    })
}

fn same_dir(a: &str, b: &str) -> bool {
    a.trim_end_matches('\\').eq_ignore_ascii_case(b.trim_end_matches('\\'))
}

/// `kind` = "path" | "contextMenu"; `label` = texto del menú del Explorador.
#[tauri::command(async)]
pub fn set_shell_integration(kind: String, enabled: bool, label: String) -> CmdResult<()> {
    let exe = plain(&exe()?);
    let result = match kind.as_str() {
        "path" => {
            let dir = exe_dir()?;
            let mut entries: Vec<String> = reg::user_path().into_iter().filter(|entry| !same_dir(entry, &dir)).collect();
            if enabled {
                entries.push(dir);
            }
            reg::set_user_path(&entries.join(";"))
        }
        "contextMenu" if enabled => MENU_KEYS.iter().try_for_each(|key| {
            reg::set(key, "", &label)?;
            reg::set(key, "Icon", &format!("\"{exe}\",0"))?;
            reg::set(&format!(r"{key}\command"), "", &format!("\"{exe}\" \"%V\""))
        }),
        "contextMenu" => MENU_KEYS.iter().try_for_each(|key| reg::delete(key)),
        _ => return Err(AppError::raw(format!("unknown integration {kind}"))),
    };
    result.map_err(AppError::raw)
}

/// `--unregister` del desinstalador: quita todo y la app no arranca.
pub fn unregister_if_requested() -> bool {
    if !std::env::args().skip(1).any(|arg| arg.eq_ignore_ascii_case("--unregister")) {
        return false;
    }
    let _ = set_shell_integration("path".into(), false, String::new());
    let _ = set_shell_integration("contextMenu".into(), false, String::new());
    true
}

mod reg {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, LPARAM, WPARAM};
    use windows::Win32::System::Registry::{
        RegDeleteTreeW, RegGetValueW, RegSetKeyValueW, HKEY_CURRENT_USER, REG_EXPAND_SZ, REG_SZ, REG_VALUE_TYPE,
        RRF_NOEXPAND, RRF_RT_ANY, RRF_RT_REG_EXPAND_SZ, RRF_RT_REG_SZ,
    };
    use windows::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE};

    pub fn exists(key: &str) -> bool {
        unsafe { RegGetValueW(HKEY_CURRENT_USER, &HSTRING::from(key), PCWSTR::null(), RRF_RT_ANY, None, None, None) }.is_ok()
    }

    fn write(key: &str, name: &str, kind: REG_VALUE_TYPE, value: &str) -> Result<(), String> {
        let data: Vec<u16> = value.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            RegSetKeyValueW(
                HKEY_CURRENT_USER,
                &HSTRING::from(key),
                &HSTRING::from(name),
                kind.0,
                Some(data.as_ptr().cast()),
                (data.len() * 2) as u32,
            )
        }
        .ok()
        .map_err(|err| err.to_string())
    }

    pub fn set(key: &str, name: &str, value: &str) -> Result<(), String> {
        write(key, name, REG_SZ, value)
    }

    pub fn delete(key: &str) -> Result<(), String> {
        let status = unsafe { RegDeleteTreeW(HKEY_CURRENT_USER, &HSTRING::from(key)) };
        if status.is_ok() || status == ERROR_FILE_NOT_FOUND { Ok(()) } else { Err(status.to_hresult().message()) }
    }

    /// Entradas del PATH de usuario, sin expandir (`%USERPROFILE%\…` se conserva tal cual).
    pub fn user_path() -> Vec<String> {
        let (key, name) = (HSTRING::from("Environment"), HSTRING::from("Path"));
        let flags = RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ | RRF_NOEXPAND;
        let mut size = 0u32;
        let mut buffer: Vec<u16>;
        unsafe {
            if RegGetValueW(HKEY_CURRENT_USER, &key, &name, flags, None, None, Some(&mut size)).is_err() {
                return Vec::new();
            }
            buffer = vec![0; size as usize / 2 + 1];
            if RegGetValueW(HKEY_CURRENT_USER, &key, &name, flags, None, Some(buffer.as_mut_ptr().cast()), Some(&mut size)).is_err() {
                return Vec::new();
            }
        }
        let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
        String::from_utf16_lossy(&buffer[..len]).split(';').filter(|entry| !entry.is_empty()).map(String::from).collect()
    }

    /// Guarda el PATH y avisa a Explorer, para que las terminales nuevas lo vean sin cerrar sesión.
    pub fn set_user_path(value: &str) -> Result<(), String> {
        write("Environment", "Path", REG_EXPAND_SZ, value)?;
        let area = HSTRING::from("Environment");
        unsafe {
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                WPARAM(0),
                LPARAM(area.as_ptr() as isize),
                SMTO_ABORTIFHUNG,
                2000,
                None,
            );
        }
        Ok(())
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        std::iter::once("file-manager.exe").chain(list.iter().copied()).map(String::from).collect()
    }

    #[test]
    fn resolves_relative_folders_and_files() {
        let dir = std::env::temp_dir().join("mi-cli-test");
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("a.txt"), "").unwrap();
        let root = plain(&std::fs::canonicalize(&dir).unwrap());

        let folder = parse(args(&["sub"]), &dir).unwrap();
        assert_eq!(folder.path, format!(r"{root}\sub"));
        assert!(folder.select.is_none());

        let file = parse(args(&["--new-window", "a.txt"]), &dir).unwrap();
        assert_eq!(file.path, root);
        assert_eq!(file.select.as_deref(), Some(format!(r"{root}\a.txt").as_str()));

        let selected = parse(args(&["--select", "sub"]), &dir).unwrap();
        assert_eq!(selected.path, root);

        assert!(parse(args(&["no-existe"]), &dir).is_none());
        // Comilla final pegada de `"…\"`.
        assert_eq!(parse(args(&[&format!("{root}\\\"")]), &dir).unwrap().path, root);
    }
}
