//! Git integrovaný do výpisu: stav souborů, větev, stage/commit/push/pull a diff.
//!
//! Volá `git.exe` z PATH (stejně jako Průzkumník s TortoiseGit/VS Code) —
//! žádná nová nativní závislost. Každý command je async, takže pomalé `git
//! status` ve velkém repu ani push po síti neblokují UI. Konzolové okno se
//! nezobrazí (CREATE_NO_WINDOW), stdin je prázdný a `GIT_TERMINAL_PROMPT=0` —
//! bez přihlašovacích údajů v Credential Manageru push skončí chybou, místo aby
//! čekal na zadání hesla v neviditelné konzoli.

use std::path::Path;
use std::process::{Command, Stdio};

use serde::Serialize;

use crate::git_parse::{parse_status, GitStatus};
use crate::{AppError, CmdResult};

/// Diff delší než tohle se zkrátí — náhled by jinak vykresloval megabajty.
const MAX_DIFF_BYTES: usize = 1_048_576;

/// Spustí git v `dir`. Nenulový návratový kód = chyba s textem ze stderr
/// (případně stdout — `git commit` bez změn píše jen tam).
fn run(dir: &Path, args: &[&str], ok_codes: &[i32]) -> CmdResult<String> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(dir)
        // Diakritika v cestách jako text, ne jako \303\251.
        .args(["-c", "core.quotepath=off", "-c", "color.ui=false"])
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command.output().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            AppError::new("error.gitMissing")
        } else {
            AppError::raw(error)
        }
    })?;

    let code = output.status.code().unwrap_or(-1);
    if ok_codes.contains(&code) {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let detail = if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() };
    Err(AppError::new("error.gitFailed").arg("detail", detail.to_string()))
}

fn git(dir: &Path, args: &[&str]) -> CmdResult<String> {
    run(dir, args, &[0])
}

/// Kořen repa pro složku, None mimo repo (nebo uvnitř `.git`).
fn toplevel(path: &Path) -> CmdResult<Option<String>> {
    match git(path, &["rev-parse", "--show-toplevel"]) {
        Ok(out) => {
            let root = out.trim();
            if root.is_empty() {
                return Ok(None);
            }
            Ok(Some(root.replace('/', std::path::MAIN_SEPARATOR_STR)))
        }
        Err(error) if error.key == "error.gitFailed" => Ok(None),
        Err(error) => Err(error),
    }
}

fn has_head(root: &Path) -> bool {
    git(root, &["rev-parse", "--verify", "-q", "HEAD"]).is_ok()
}

/// Stav repa, ve kterém leží `path`; None mimo repo i bez nainstalovaného gitu
/// (výpis se tím nemá rozbít — git je jen nadstavba).
#[tauri::command(async)]
pub fn git_status(path: String) -> CmdResult<Option<GitStatus>> {
    let Some(root) = toplevel(Path::new(&path)).unwrap_or(None) else {
        return Ok(None);
    };
    let out = git(
        Path::new(&root),
        &["status", "--porcelain=v2", "--branch", "-z", "--ignored=matching"],
    )?;
    Ok(Some(parse_status(root, &out)))
}

/// `git add -A` — zahrne i smazané soubory.
#[tauri::command(async)]
pub fn git_stage(root: String, paths: Vec<String>) -> CmdResult<()> {
    let mut args = vec!["add", "-A", "--"];
    args.extend(paths.iter().map(String::as_str));
    git(Path::new(&root), &args).map(|_| ())
}

#[tauri::command(async)]
pub fn git_unstage(root: String, paths: Vec<String>) -> CmdResult<()> {
    let root = Path::new(&root);
    // Před prvním commitem HEAD neexistuje a `reset` by selhal.
    let mut args = if has_head(root) {
        vec!["reset", "-q", "HEAD", "--"]
    } else {
        vec!["rm", "--cached", "-r", "-q", "--ignore-unmatch", "--"]
    };
    args.extend(paths.iter().map(String::as_str));
    git(root, &args).map(|_| ())
}

#[tauri::command(async)]
pub fn git_commit(root: String, message: String) -> CmdResult<()> {
    if message.trim().is_empty() {
        return Err(AppError::new("error.gitEmptyMessage"));
    }
    git(Path::new(&root), &["commit", "-q", "-m", &message]).map(|_| ())
}

/// Push; větev bez upstreamu se nastaví na `origin` (jako „Publish branch“).
#[tauri::command(async)]
pub fn git_push(root: String) -> CmdResult<()> {
    let root = Path::new(&root);
    let has_upstream = git(root, &["rev-parse", "--abbrev-ref", "@{upstream}"]).is_ok();
    if has_upstream {
        git(root, &["push"]).map(|_| ())
    } else {
        git(root, &["push", "--set-upstream", "origin", "HEAD"]).map(|_| ())
    }
}

/// Pull bez editoru — merge commit dostane výchozí zprávu.
#[tauri::command(async)]
pub fn git_pull(root: String) -> CmdResult<()> {
    git(Path::new(&root), &["pull", "--no-edit"]).map(|_| ())
}

#[derive(Debug, Serialize)]
pub struct GitDiff {
    text: String,
    truncated: bool,
}

/// Diff souboru proti HEAD (staged i unstaged dohromady); nesledovaný soubor
/// celý jako přidaný; `staged` = jen to, co jde do commitu.
#[tauri::command(async)]
pub fn git_diff(root: String, path: String, untracked: bool, staged: bool) -> CmdResult<GitDiff> {
    let root = Path::new(&root);
    let base = ["diff", "--no-ext-diff", "--no-color"];
    let mut text = if untracked {
        // --no-index vrací 1, když se soubory liší — to je tady vždy.
        let mut args = base.to_vec();
        args.extend(["--no-index", "--", "/dev/null", path.as_str()]);
        run(root, &args, &[0, 1])?
    } else {
        let mut args = base.to_vec();
        if staged {
            args.push("--cached");
        } else if has_head(root) {
            args.push("HEAD");
        }
        args.extend(["--", path.as_str()]);
        git(root, &args)?
    };

    let truncated = text.len() > MAX_DIFF_BYTES;
    if truncated {
        let mut end = MAX_DIFF_BYTES;
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
    }
    Ok(GitDiff { text, truncated })
}
