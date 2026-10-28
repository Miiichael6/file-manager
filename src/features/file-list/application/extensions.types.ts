import type { FileEntry } from "../../../shared/domain/types";

export type DisplayNames = {
  /** Název položky výpisu. */
  entry: (entry: FileEntry) => string;
  /** Holý název (nedávné soubory, Koš, dialogy). */
  name: (name: string, isDir?: boolean) => string;
  /** Skrývá se u položky přípona? (přejmenování ji pak doplní zpátky) */
  hidesExtension: (entry: FileEntry) => boolean;
};
