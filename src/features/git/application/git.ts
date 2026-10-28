/**
 * Git ve výpisu: stav souborů (odznaky v řádcích), větev ve status baru a
 * akce stage/unstage/commit/push/pull. Backend volá git.exe (git.rs).
 *
 * Tady jsou typy a čisté funkce; sdílený stav drží gitStore.ts, volání
 * backendu gitActions.ts.
 */

/** Jak git vidí položku; pořadí = priorita při shrnutí složky. */
export type GitState = "conflicted" | "deleted" | "modified" | "added" | "renamed" | "untracked" | "ignored";

export const PRIORITY: GitState[] = ["conflicted", "deleted", "modified", "renamed", "added", "untracked", "ignored"];

/** Odpovídá GitFile v git.rs. `.` = beze změny, `?` nesledovaný, `!` ignorovaný. */
export type GitFile = {
  path: string;
  orig_path: string | null;
  index: string;
  worktree: string;
  conflicted: boolean;
};

export type GitStatus = {
  root: string;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFile[];
};

/* --------------------------------- cesty ---------------------------------- */

/** Klíč cesty: Windows je case-insensitive, oddělovač `\`, bez koncového. */
export function keyOf(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

/** Absolutní cesta položky z GitFile (bez koncového `\` u složek). */
export function absolutePath(root: string, file: GitFile): string {
  return `${root.replace(/[\\/]+$/, "")}\\${file.path.replace(/\/$/, "").replace(/\//g, "\\")}`;
}

/* --------------------------------- stav ---------------------------------- */

export function stateOf(file: GitFile): GitState {
  if (file.conflicted) return "conflicted";
  if (file.index === "?") return "untracked";
  if (file.index === "!") return "ignored";
  if (file.index === "D" || file.worktree === "D") return "deleted";
  if (file.worktree === "M" || file.index === "M" || file.worktree === "T" || file.index === "T") return "modified";
  if (file.index === "R" || file.index === "C") return "renamed";
  if (file.index === "A") return "added";
  return "modified";
}

/** Změna připravená v indexu (půjde do commitu). */
export function isStaged(file: GitFile): boolean {
  return !file.conflicted && file.index !== "." && file.index !== "?" && file.index !== "!";
}

/** Změna v pracovním stromu, kterou jde přidat do indexu. */
export function isUnstaged(file: GitFile): boolean {
  return file.conflicted || file.index === "?" || (file.worktree !== "." && file.worktree !== "!");
}
