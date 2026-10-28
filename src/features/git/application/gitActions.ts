import { useEffect, useState } from "react";

import type { GitStatus } from "../domain/git.types";
import { gitRootFor, repoStatus, setRepoStatus, useGitVersion } from "./gitStore";
import { gitRepository } from "./ports";
import type { DiffState } from "./gitActions.types";

/** Načítání stavu repa a akce nad ním (port GitRepository). Stav sám drží gitStore.ts. */

/** Probíhající dotazy podle složky — dva panely ve stejném repu se nesčítají. */
const inflight = new Map<string, Promise<GitStatus | null>>();

/** Načte stav repa pro složku a uloží ho do storu; null = mimo repo / bez gitu. */
export function refreshGit(path: string): Promise<GitStatus | null> {
  const pending = inflight.get(path);
  if (pending) return pending;

  const request = gitRepository
    .get()
    .status(path)
    .catch(() => null)
    .then((status) => {
      if (status !== null) setRepoStatus(status);
      return status;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, request);
  return request;
}

/**
 * Stav repa pro složku panelu. `token` = cokoli, co se mění s obsahem
 * výpisu (pole položek) — změna na disku (watcher) tak obnoví i git.
 */
export function useGitRepo(path: string | null, token: unknown): GitStatus | null {
  const [root, setRoot] = useState<string | null>(null);
  useGitVersion();

  useEffect(() => {
    if (path === null) {
      setRoot(null);
      return;
    }
    let cancelled = false;
    // Krátká prodleva: watcher posílá změny v dávkách a git status není zadarmo.
    const timer = window.setTimeout(() => {
      void refreshGit(path).then((status) => {
        if (!cancelled) setRoot(status?.root ?? null);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [path, token]);

  // Ze storu — po stage/commit jinde (dialog, druhý panel) je tam čerstvější stav.
  return path !== null && root !== null && gitRootFor(path) !== null ? repoStatus(root) : null;
}

/** Operace nad repem; po ní se stav vždy načte znovu (i po chybě — pull mohl napůl projít). */
async function run(root: string, operation: Promise<void>): Promise<void> {
  try {
    await operation;
  } finally {
    await refreshGit(root);
  }
}

const repo = () => gitRepository.get();

export const gitStage = (root: string, paths: string[]) => run(root, repo().stage(root, paths));
export const gitUnstage = (root: string, paths: string[]) => run(root, repo().unstage(root, paths));
export const gitCommit = (root: string, message: string) => run(root, repo().commit(root, message));
export const gitPush = (root: string) => run(root, repo().push(root));
export const gitPull = (root: string) => run(root, repo().pull(root));
export const gitFetch = (root: string) => run(root, repo().fetch(root));
export const gitCheckout = (root: string, branch: string) => run(root, repo().checkout(root, branch));
/** Místní větve, naposledy použité první. */
export const gitBranches = (root: string) => repo().branches(root);

/**
 * Diff souboru (git.rs `git_diff`); `text: null` = načítá se. Po změně stavu
 * repa (stage, watcher) se načte znovu, starý text do té doby zůstává.
 */
export function useGitDiff(
  root: string | null,
  path: string | null,
  untracked: boolean,
  staged: boolean,
): DiffState {
  const [state, setState] = useState<DiffState>({ text: null, truncated: false, error: null });
  const gitVersion = useGitVersion();

  useEffect(() => {
    setState({ text: null, truncated: false, error: null });
  }, [root, path, staged]);

  useEffect(() => {
    if (root === null || path === null) return;
    let cancelled = false;
    repo()
      .diff(root, path, untracked, staged)
      .then(({ text, truncated }) => {
        if (!cancelled) setState({ text, truncated, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ text: null, truncated: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [root, path, untracked, staged, gitVersion]);

  return state;
}
