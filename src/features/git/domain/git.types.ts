/** Jak git vidí položku; pořadí = priorita při shrnutí složky. */
export type GitState = "conflicted" | "deleted" | "modified" | "added" | "renamed" | "untracked" | "ignored";

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
