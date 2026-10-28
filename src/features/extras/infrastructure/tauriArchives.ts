import { invoke } from "../../../shared/infrastructure/fileops";
import type { Archives } from "../domain/ports";

/** Adaptér Archives nad commandy zip_create / zip_extract. */
export const tauriArchives: Archives = {
  create: (paths, dir, name) => invoke<string>("zip_create", { paths, dir, name }),
  extract: (path) => invoke<string>("zip_extract", { path }),
};
