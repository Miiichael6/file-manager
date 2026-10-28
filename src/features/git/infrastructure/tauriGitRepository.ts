import { invoke } from "../../../shared/infrastructure/fileops";
import type { GitStatus } from "../domain/git";
import type { GitDiff, GitRepository } from "../domain/ports";

/** Adaptér GitRepository nad commandy git.rs. */
export const tauriGitRepository: GitRepository = {
  status: (path) => invoke<GitStatus | null>("git_status", { path }),
  stage: (root, paths) => invoke("git_stage", { root, paths }),
  unstage: (root, paths) => invoke("git_unstage", { root, paths }),
  commit: (root, message) => invoke("git_commit", { root, message }),
  push: (root) => invoke("git_push", { root }),
  pull: (root) => invoke("git_pull", { root }),
  fetch: (root) => invoke("git_fetch", { root }),
  checkout: (root, branch) => invoke("git_checkout", { root, branch }),
  branches: (root) => invoke<string[]>("git_branches", { root }),
  diff: (root, path, untracked, staged) => invoke<GitDiff>("git_diff", { root, path, untracked, staged }),
};
