import type { FileEntry } from "../../../shared/domain/types";

/** Cíl pro pouštění do složky: přesun, s Ctrl kopie. */
export type DropInto = (folder: string, paths: string[], copy: boolean) => void;

/** Handlery přetažení pro řádek složky. Stabilní identita — řádky jsou
 *  memoizované a nové funkce při každém renderu by memo rozbily. */
export type FolderDropHandlers = {
  over: (entry: FileEntry, event: React.DragEvent) => void;
  leave: (entry: FileEntry, event: React.DragEvent) => void;
  drop: (entry: FileEntry, event: React.DragEvent) => void;
};
