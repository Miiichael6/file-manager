import type { FileEntry, SelectMods, TagColor, TagMap } from "../../../../shared/domain/types";
import type { dragItemsFor } from "../../application/dnd";
import type { DropInto, FolderDropHandlers } from "../../application/rowDnd.types";
import type { ViewHandleRef } from "../../application/viewHandle";

export type CellHandlers = {
  select: (entry: FileEntry, mods: SelectMods) => void;
  open: (entry: FileEntry) => void;
  contextMenu: (entry: FileEntry, x: number, y: number) => void;
  dragItems: (entry: FileEntry) => ReturnType<typeof dragItemsFor>;
  renameSubmit: (entry: FileEntry, name: string) => void;
  renameCancel: () => void;
  drop: FolderDropHandlers;
};

export type CellProps = {
  entry: FileEntry;
  /** Smí se ptát shellu na náhled videa / PDF (prvních 200 ve složce). */
  shellPreview: boolean;
  selected: boolean;
  cut: boolean;
  renaming: boolean;
  dropTarget: boolean;
  windowFocused: boolean;
  tags: TagColor[];
  handlers: CellHandlers;
};

export type IconViewProps = {
  entries: FileEntry[];
  selectedPaths: Set<string>;
  cutPaths: Set<string>;
  windowFocused: boolean;
  renamingPath: string | null;
  onRenameSubmit: (entry: FileEntry, name: string) => void;
  onRenameCancel: () => void;
  onSelect: (entry: FileEntry, mods: SelectMods) => void;
  onOpen: (entry: FileEntry) => void;
  onContextMenu?: (entry: FileEntry, x: number, y: number) => void;
  onDropInto: DropInto;
  tags: TagMap;
  /** Posouvaný kontejner (drží ho App) — virtualizace podle něj měří. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Ovládání výpisu pro App (posun na položku, gumička, klávesnice). */
  handleRef: ViewHandleRef;
  /** Počáteční posun (návrat Zpět). Virtualizace si při připojení scroller
   *  sama nastaví na svou pozici — bez tohohle by ho vrátila na začátek. */
  initialOffset?: number;
};
