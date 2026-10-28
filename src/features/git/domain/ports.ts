import type { GitStatus } from "./git.types";

export type GitDiff = { text: string; truncated: boolean };

/** Přístup k repozitáři (backend git.rs). Každá operace pracuje s kořenem repa. */
export interface GitRepository {
  /** Stav repa pro složku; null = mimo repo nebo bez gitu. */
  status(path: string): Promise<GitStatus | null>;
  stage(root: string, paths: string[]): Promise<void>;
  unstage(root: string, paths: string[]): Promise<void>;
  commit(root: string, message: string): Promise<void>;
  push(root: string): Promise<void>;
  pull(root: string): Promise<void>;
  fetch(root: string): Promise<void>;
  checkout(root: string, branch: string): Promise<void>;
  /** Místní větve, naposledy použité první. */
  branches(root: string): Promise<string[]>;
  diff(root: string, path: string, untracked: boolean, staged: boolean): Promise<GitDiff>;
}
