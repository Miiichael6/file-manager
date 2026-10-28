//! MI-FORK: extras del menú contextual — comprimir / descomprimir ZIP y
//! tamaño de carpetas para la vista Lista (src/mi-fork/useExtras.tsx, folderSizes.ts).

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use walkdir::WalkDir;

use crate::{describe_io, AppError, CmdResult};

/* ---------------------------------- ZIP ----------------------------------- */

/// «nombre.zip», «nombre (2).zip»… en `dir` — como Nueva carpeta, pero con
/// el número antes de la extensión.
fn free_name(dir: &Path, name: &str) -> CmdResult<PathBuf> {
    let (stem, ext) = match name.rfind('.') {
        Some(dot) if dot > 0 => (&name[..dot], &name[dot..]),
        _ => (name, ""),
    };
    (1..10_000)
        .map(|n| if n == 1 { dir.join(name) } else { dir.join(format!("{stem} ({n}){ext}")) })
        .find(|candidate| !candidate.exists())
        .ok_or_else(|| AppError::new("error.noFreeName"))
}

/// Unix segundos → fecha y hora local (el ZIP guarda la hora local, sin zona).
#[cfg(windows)]
fn zip_time(modified: SystemTime) -> Option<zip::DateTime> {
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::Storage::FileSystem::FileTimeToLocalFileTime;

    // FILETIME = intervalos de 100 ns desde 1601.
    let ticks = modified.duration_since(UNIX_EPOCH).ok()?.as_secs() * 10_000_000 + 116_444_736_000_000_000;
    let utc = FILETIME { dwLowDateTime: ticks as u32, dwHighDateTime: (ticks >> 32) as u32 };
    let mut local = FILETIME::default();
    unsafe { FileTimeToLocalFileTime(&utc, &mut local) }.ok()?;
    let local = (((local.dwHighDateTime as u64) << 32) | local.dwLowDateTime as u64) / 10_000_000;
    let secs = local.checked_sub(11_644_473_600)? as i64;

    // Días desde 1970 → fecha civil (algoritmo de Howard Hinnant).
    let (days, rest) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u8;
    let year = (yoe + era * 400 + i64::from(month <= 2)) as u16;
    zip::DateTime::from_date_and_time(year, month, day, (rest / 3600) as u8, (rest / 60 % 60) as u8, (rest % 60) as u8).ok()
}

#[cfg(not(windows))]
fn zip_time(_: SystemTime) -> Option<zip::DateTime> {
    None
}

/// Comprime `paths` (archivos y carpetas de una misma carpeta) en `dir\name`
/// (con número si ya existe). Devuelve la ruta del ZIP creado.
#[tauri::command(async)]
pub fn zip_create(paths: Vec<String>, dir: String, name: String) -> CmdResult<String> {
    use zip::write::SimpleFileOptions;

    let target = free_name(Path::new(&dir), name.trim())?;
    let fail = |at: &Path, err: io::Error| AppError::at(at.to_string_lossy(), describe_io(&err));
    let file = fs::File::create(&target).map_err(|err| fail(&target, err))?;
    let mut writer = zip::ZipWriter::new(io::BufWriter::new(file));

    let result = (|| -> CmdResult<()> {
        for path in &paths {
            let base = Path::new(path).parent().unwrap_or(Path::new(""));
            for item in WalkDir::new(path).follow_links(false).sort_by_file_name() {
                let item = item.map_err(AppError::raw)?;
                if item.path() == target {
                    continue;
                }
                let relative = item.path().strip_prefix(base).unwrap_or(item.path());
                let entry = relative.to_string_lossy().replace('\\', "/");
                let meta = item.metadata().map_err(AppError::raw)?;
                let mut options = SimpleFileOptions::default().large_file(meta.len() >= u32::MAX as u64);
                if let Some(time) = meta.modified().ok().and_then(zip_time) {
                    options = options.last_modified_time(time);
                }
                if item.file_type().is_dir() {
                    writer.add_directory(entry, options).map_err(AppError::raw)?;
                } else {
                    writer.start_file(entry, options).map_err(AppError::raw)?;
                    let mut source = fs::File::open(item.path()).map_err(|err| fail(item.path(), err))?;
                    io::copy(&mut source, &mut writer).map_err(|err| fail(item.path(), err))?;
                }
            }
        }
        writer.finish().map_err(AppError::raw)?;
        Ok(())
    })();

    // A medias no sirve de nada — fuera.
    if let Err(err) = result {
        let _ = fs::remove_file(&target);
        return Err(err);
    }
    Ok(target.to_string_lossy().into_owned())
}

/// Extrae el ZIP junto a él. Con una sola entrada raíz (una carpeta o un
/// archivo) la deja tal cual al lado; si no, todo va a una carpeta nueva con
/// el nombre del ZIP — nunca se mezcla con lo que ya hay. Devuelve lo creado.
#[tauri::command(async)]
pub fn zip_extract(path: String) -> CmdResult<String> {
    let source = Path::new(&path);
    let dir = source.parent().ok_or_else(|| AppError::new("error.noParent"))?;
    let file = fs::File::open(source).map_err(|err| AppError::at(&path, describe_io(&err)))?;
    let mut archive = zip::ZipArchive::new(io::BufReader::new(file))
        .map_err(|err| AppError::at(&path, AppError::new("error.zipInvalid").arg("detail", err.to_string())))?;

    // Rutas seguras (enclosed_name descarta «..» y rutas absolutas).
    let names: Vec<Option<PathBuf>> =
        (0..archive.len()).map(|i| archive.by_index_raw(i).ok().and_then(|e| e.enclosed_name())).collect();
    let mut roots: Vec<_> = names.iter().flatten().filter_map(|name| name.components().next()).collect();
    roots.sort();
    roots.dedup();

    let (out_dir, rename_root, created) = if roots.len() == 1 {
        let root = PathBuf::from(roots[0].as_os_str());
        let free = free_name(dir, &root.to_string_lossy())?;
        (dir.to_path_buf(), Some((root, free.file_name().unwrap_or_default().to_owned())), free)
    } else {
        let stem = source.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let folder = free_name(dir, &stem)?;
        fs::create_dir(&folder).map_err(|err| AppError::at(folder.to_string_lossy(), describe_io(&err)))?;
        (folder.clone(), None, folder)
    };

    for (i, name) in names.into_iter().enumerate() {
        let Some(mut name) = name else { continue };
        if let Some((root, free)) = &rename_root {
            if let Ok(rest) = name.strip_prefix(root) {
                name = Path::new(free).join(rest);
            }
        }
        let target = out_dir.join(&name);
        let fail = |err: io::Error| AppError::at(target.to_string_lossy(), describe_io(&err));
        let mut entry = archive.by_index(i).map_err(AppError::raw)?;
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(fail)?;
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(fail)?;
        }
        let mut out = fs::File::create(&target).map_err(fail)?;
        io::copy(&mut entry, &mut out).map_err(fail)?;
    }

    Ok(created.to_string_lossy().into_owned())
}

/* --------------------------- tamaño de carpetas --------------------------- */

#[derive(Clone, Serialize)]
pub struct FolderSize {
    path: String,
    bytes: u64,
    /// false = cálculo en curso (valor parcial); true = definitivo.
    done: bool,
}

/// Recorridos en curso por id de petición — al cambiar de carpeta se cancelan.
fn running() -> &'static Mutex<HashMap<u64, Arc<AtomicBool>>> {
    static RUNNING: OnceLock<Mutex<HashMap<u64, Arc<AtomicBool>>>> = OnceLock::new();
    RUNNING.get_or_init(Default::default)
}

/// Suma el tamaño de cada carpeta (sin seguir enlaces), una tras otra; cada
/// resultado llega por el canal en cuanto está, con parciales cada ~0,5 s.
#[tauri::command(async)]
pub fn folder_sizes(paths: Vec<String>, request_id: u64, on_size: tauri::ipc::Channel<FolderSize>) {
    let cancelled = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = running().lock() {
        map.insert(request_id, cancelled.clone());
    }

    'folders: for path in paths {
        let mut bytes = 0u64;
        let mut last = Instant::now();
        for item in WalkDir::new(&path).follow_links(false).min_depth(1).into_iter().flatten() {
            if cancelled.load(Ordering::Relaxed) {
                break 'folders;
            }
            if item.file_type().is_file() {
                bytes += item.metadata().map(|meta| meta.len()).unwrap_or(0);
            }
            if last.elapsed() >= Duration::from_millis(500) {
                last = Instant::now();
                let _ = on_size.send(FolderSize { path: path.clone(), bytes, done: false });
            }
        }
        let _ = on_size.send(FolderSize { path, bytes, done: true });
    }

    if let Ok(mut map) = running().lock() {
        map.remove(&request_id);
    }
}

#[tauri::command(async)]
pub fn cancel_folder_sizes(request_id: u64) {
    if let Some(flag) = running().lock().ok().and_then(|map| map.get(&request_id).cloned()) {
        flag.store(true, Ordering::Relaxed);
    }
}

/* ------------------------------ Uso de unidades ----------------------------- */

#[derive(Serialize)]
pub struct DriveUsage {
    path: String,
    total: u64,
    free: u64,
}

/// Capacidad y espacio libre de cada unidad del sidebar (la dona junto a «Disco
/// local (C:)»). Las que no responden (lector vacío, red caída) se omiten.
#[cfg(windows)]
#[tauri::command(async)]
pub fn drive_usage(paths: Vec<String>) -> Vec<DriveUsage> {
    use windows::core::HSTRING;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    paths
        .into_iter()
        .filter_map(|path| {
            let (mut free, mut total) = (0u64, 0u64);
            unsafe { GetDiskFreeSpaceExW(&HSTRING::from(path.as_str()), Some(&mut free), Some(&mut total), None) }
                .ok()?;
            (total > 0).then_some(DriveUsage { path, total, free })
        })
        .collect()
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn drive_usage(_paths: Vec<String>) -> Vec<DriveUsage> {
    Vec::new()
}
