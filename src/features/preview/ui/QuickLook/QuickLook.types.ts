import type { FileEntry } from "../../../../shared/domain/types";

export type Origin = { x: number; y: number };

/** `truncated` = soubor je delší a ukazuje se jen začátek (poznámka se
 *  připisuje až při vykreslení, v aktuálním jazyce). */
export type TextState = {
  loading: boolean;
  content: string | null;
  truncated: boolean;
  error: string | null;
};

export type QuickLookProps = {
  /** Seznam v pořadí zdrojového view; složky se přeskakují. */
  entries: FileEntry[];
  entry: FileEntry;
  onClose: () => void;
  onOpenFile: (entry: FileEntry) => void;
  /** Pravý klik na kartu — menu pro právě zobrazený soubor. */
  onContextMenu: (entry: FileEntry, x: number, y: number) => void;
  /** Šipky přepnuly soubor — výběr ve výpisu se má posunout s ním, jinak
   *  by po zavření zůstal vybraný ten, kterým se začínalo. */
  onCurrentChange?: (entry: FileEntry) => void;
};
