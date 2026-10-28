import type { FileEntry, TagColor, ViewMode } from "../../../shared/domain/types";
import type { PanelSearch } from "../../search/domain/searchCriteria.types";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Commands } from "../../command-palette/domain/commands.types";

export type UseKeyboardNavigationOptions = {
  modalOpen: boolean;
  switchToTabNumber: (number: number) => void;
  tagFilter: TagColor | null;
  search: PanelSearch | null;
  trashView: boolean;
  commandsRef: RefObject<Commands | null>;
  setQuery: Dispatch<SetStateAction<string>>;
  activeEntry: FileEntry | null;
  setQuickLookOpen: Dispatch<SetStateAction<boolean>>;
  viewMode: ViewMode;
  moveSelection: (delta: number, extend: boolean, behavior?: ScrollBehavior) => void;
  isColumnView: boolean;
  viewMetrics: () => { columns: number; rowsPerPage: number; };
  selectIndex: (index: number, extend: boolean, behavior?: ScrollBehavior) => void;
  visibleEntries: FileEntry[];
  findByPrefix: (key: string, entries: FileEntry[]) => FileEntry | null;
  setSelection: Dispatch<SetStateAction<Set<string>>>;
  setActive: Dispatch<SetStateAction<FileEntry | null>>;
  open: (entry: FileEntry) => void;
};
