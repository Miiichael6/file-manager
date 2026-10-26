//! Rozbor výstupu `git status --porcelain=v2 --branch -z` (git.rs).

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct GitFile {
    /// Cesta relativně ke kořeni repa, oddělovač `/`; složka (nesledovaná nebo
    /// ignorovaná jako celek) končí `/`.
    pub path: String,
    /// Původní cesta u přejmenování.
    pub orig_path: Option<String>,
    /// Stav v indexu a v pracovním stromu jako v `git status --short`
    /// (`.` = beze změny, `?` nesledovaný, `!` ignorovaný).
    pub index: char,
    pub worktree: char,
    pub conflicted: bool,
}

#[derive(Debug, Serialize)]
pub struct GitStatus {
    /// Kořen pracovního stromu (Windows cesta s `\`).
    pub root: String,
    /// None = odpojená HEAD.
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u64,
    pub behind: u64,
    pub files: Vec<GitFile>,
}

/// Rozebere `git status --porcelain=v2 --branch -z`.
pub fn parse_status(root: String, out: &str) -> GitStatus {
    let mut status = GitStatus {
        root,
        branch: None,
        upstream: None,
        ahead: 0,
        behind: 0,
        files: Vec::new(),
    };

    let mut records = out.split('\0');
    while let Some(record) = records.next() {
        if let Some(header) = record.strip_prefix("# ") {
            let (name, value) = header.split_once(' ').unwrap_or((header, ""));
            match name {
                "branch.head" if value != "(detached)" => status.branch = Some(value.to_string()),
                "branch.upstream" => status.upstream = Some(value.to_string()),
                "branch.ab" => {
                    for part in value.split(' ') {
                        if let Some(n) = part.strip_prefix('+') {
                            status.ahead = n.parse().unwrap_or(0);
                        } else if let Some(n) = part.strip_prefix('-') {
                            status.behind = n.parse().unwrap_or(0);
                        }
                    }
                }
                _ => {}
            }
            continue;
        }

        // Počet polí před cestou: 1 = 8, 2 = 9 (+ původní cesta jako další
        // záznam), u = 10. Cesta sama může obsahovat mezery, proto splitn.
        let (fields, conflicted) = match record.as_bytes().first() {
            Some(b'1') => (9, false),
            Some(b'2') => (10, false),
            Some(b'u') => (11, true),
            Some(b'?') | Some(b'!') => {
                let kind = record.chars().next().unwrap_or('?');
                status.files.push(GitFile {
                    path: record[2.min(record.len())..].to_string(),
                    orig_path: None,
                    index: kind,
                    worktree: kind,
                    conflicted: false,
                });
                continue;
            }
            _ => continue,
        };

        let parts: Vec<&str> = record.splitn(fields, ' ').collect();
        if parts.len() < fields {
            continue;
        }
        let mut xy = parts[1].chars();
        let orig_path = if record.starts_with('2') {
            records.next().map(str::to_string)
        } else {
            None
        };
        status.files.push(GitFile {
            path: parts[fields - 1].to_string(),
            orig_path,
            index: xy.next().unwrap_or('.'),
            worktree: xy.next().unwrap_or('.'),
            conflicted,
        });
    }

    status
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_porcelain_v2() {
        let out = "# branch.oid abc\0# branch.head main\0# branch.upstream origin/main\0\
                   # branch.ab +2 -1\0\
                   1 .M N... 100644 100644 100644 a b src/my file.ts\0\
                   1 A. N... 000000 100644 100644 0 b new.txt\0\
                   2 R. N... 100644 100644 100644 a b R100 renamed.txt\0old.txt\0\
                   u UU N... 100644 100644 100644 100644 a b c conflict.rs\0\
                   ? untracked/\0! node_modules/\0";
        let status = parse_status("C:\\repo".into(), out);
        assert_eq!(status.branch.as_deref(), Some("main"));
        assert_eq!(status.upstream.as_deref(), Some("origin/main"));
        assert_eq!((status.ahead, status.behind), (2, 1));
        let summary: Vec<(String, char, char, bool)> = status
            .files
            .iter()
            .map(|f| (f.path.clone(), f.index, f.worktree, f.conflicted))
            .collect();
        assert_eq!(
            summary,
            vec![
                ("src/my file.ts".into(), '.', 'M', false),
                ("new.txt".into(), 'A', '.', false),
                ("renamed.txt".into(), 'R', '.', false),
                ("conflict.rs".into(), 'U', 'U', true),
                ("untracked/".into(), '?', '?', false),
                ("node_modules/".into(), '!', '!', false),
            ]
        );
        assert_eq!(status.files[2].orig_path.as_deref(), Some("old.txt"));
    }

    #[test]
    fn detached_head_has_no_branch() {
        let status = parse_status("C:\\repo".into(), "# branch.head (detached)\0");
        assert_eq!(status.branch, None);
    }
}
