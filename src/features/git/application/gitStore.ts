import { useSyncExternalStore } from "react";

import { PRIORITY, absolutePath, keyOf, stateOf, type GitFile, type GitState, type GitStatus } from "../domain/git";

/**
 * Sdílený stav git podle kořene repa — oba panely i všechny řádky se ptají na
 * cestu a store najde repo, ve kterém leží. Řádky výpisu jsou memo, proto si
 * stav berou samy (useSyncExternalStore), ne přes props.
 */

function stronger(a: GitState | undefined, b: GitState): GitState {
  if (a === undefined) return b;
  return PRIORITY.indexOf(a) <= PRIORITY.indexOf(b) ? a : b;
}

type RepoIndex = {
  status: GitStatus;
  rootKey: string;
  /** Stav přímo podle cesty (i nesledované/ignorované složky jako celek). */
  byPath: Map<string, GitState>;
  /** Shrnutí pro nadřazené složky změněných souborů (bez ignorovaných). */
  dirs: Map<string, GitState>;
};

function buildIndex(status: GitStatus): RepoIndex {
  const rootKey = keyOf(status.root);
  const byPath = new Map<string, GitState>();
  const dirs = new Map<string, GitState>();

  for (const file of status.files) {
    const state = stateOf(file);
    const key = keyOf(absolutePath(status.root, file));
    byPath.set(key, stronger(byPath.get(key), state));
    if (state === "ignored") continue;

    // Nadřazené složky až po kořen (kořen sám ne — to je složka, ve které stojíme).
    let parent = key.slice(0, key.lastIndexOf("\\"));
    while (parent.length > rootKey.length) {
      dirs.set(parent, stronger(dirs.get(parent), state));
      parent = parent.slice(0, parent.lastIndexOf("\\"));
    }
  }

  return { status, rootKey, byPath, dirs };
}

/* --------------------------------- store ---------------------------------- */

const repos = new Map<string, RepoIndex>();
const listeners = new Set<() => void>();
/** Mění se při každém zápisu — snapshot pro useSyncExternalStore. */
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion() {
  return version;
}

function repoFor(path: string): RepoIndex | null {
  const key = keyOf(path);
  let best: RepoIndex | null = null;
  for (const repo of repos.values()) {
    if (key === repo.rootKey || key.startsWith(`${repo.rootKey}\\`)) {
      // Vnořené repo (submodul) má delší kořen a přebíjí nadřazené.
      if (best === null || repo.rootKey.length > best.rootKey.length) best = repo;
    }
  }
  return best;
}

function lookup(path: string, isDir: boolean): GitState | null {
  const repo = repoFor(path);
  if (repo === null) return null;
  const key = keyOf(path);
  if (key === repo.rootKey) return null;

  const direct = repo.byPath.get(key);
  if (direct !== undefined) return direct;

  // Uvnitř nesledované/ignorované složky, kterou git hlásí jako celek.
  let parent = key.slice(0, key.lastIndexOf("\\"));
  while (parent.length > repo.rootKey.length) {
    const state = repo.byPath.get(parent);
    if (state === "untracked" || state === "ignored") return state;
    parent = parent.slice(0, parent.lastIndexOf("\\"));
  }

  return isDir ? (repo.dirs.get(key) ?? null) : null;
}

/** Uloží načtený stav repa (gitActions.ts). */
export function setRepoStatus(status: GitStatus) {
  repos.set(keyOf(status.root), buildIndex(status));
  emit();
}

/** Čerstvý stav repa podle kořene. */
export function repoStatus(root: string): GitStatus | null {
  return repos.get(keyOf(root))?.status ?? null;
}

/** Stav položky pro odznak v řádku; null = čistá nebo mimo repo. */
export function useGitState(path: string, isDir: boolean): GitState | null {
  useGitVersion();
  return lookup(path, isDir);
}

/** GitFile pro konkrétní soubor (náhled s diffem, stage z kontextového menu). */
export function gitFileFor(path: string): { root: string; file: GitFile } | null {
  const repo = repoFor(path);
  if (repo === null) return null;
  const key = keyOf(path);
  const file = repo.status.files.find((item) => keyOf(absolutePath(repo.status.root, item)) === key);
  return file ? { root: repo.status.root, file } : null;
}

/** Kořen repa, ve kterém cesta leží (podle posledního načteného stavu). */
export function gitRootFor(path: string): string | null {
  return repoFor(path)?.status.root ?? null;
}

export function useGitVersion(): number {
  return useSyncExternalStore(subscribe, getVersion);
}
