import * as storage from "../../shared/infrastructure/storage";
import type { TransparencyStrength } from "../../shared/infrastructure/storage.types";
import type { FileEntry } from "../../shared/domain/types";

/**
 * Syntetická položka pro složku, ve které uživatel stojí. Vlastnosti si stejně
 * všechno dotáhnou z backendu podle cesty, potřebují jen název a `is_dir`.
 */
export function folderEntry(path: string): FileEntry {
  return {
    name: storage.lastSegment(path),
    path,
    is_dir: true,
    size: 0,
    modified: 0,
    created: 0,
    extension: null,
    hidden: false,
    is_symlink: false,
  };
}

/** Volba síly průhlednost rovnou zapne — jinak by nebylo nic vidět. */
export function strengthCommand(strength: TransparencyStrength, checked: boolean) {
  return {
    checked,
    run: () => {
      void storage.setTransparencyStrength(strength);
      void storage.setWindowTransparency(true);
    },
  };
}
