import type { GitState, GitStatus } from "../domain/git.types";

export type RepoIndex = {
  status: GitStatus;
  rootKey: string;
  /** Stav přímo podle cesty (i nesledované/ignorované složky jako celek). */
  byPath: Map<string, GitState>;
  /** Shrnutí pro nadřazené složky změněných souborů (bez ignorovaných). */
  dirs: Map<string, GitState>;
};
