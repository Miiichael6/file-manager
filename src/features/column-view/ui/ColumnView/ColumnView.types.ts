import type { FileEntry, SelectMods, TagColor, TagMap } from "../../../../shared/domain/types";
import type { dragItemsFor } from "../../../file-list/application/dnd";
import type { DropInto, FolderDropHandlers } from "../../../file-list/application/rowDnd.types";
import type { Column, ColumnsApi } from "../../application/columns.types";

export type RowHandlers = {
  select: (entry: FileEntry, mods?: SelectMods) => void;
  open: (entry: FileEntry) => void;
  contextMenu: (entry: FileEntry, selected: boolean, x: number, y: number) => void;
  dragItems: (entry: FileEntry) => ReturnType<typeof dragItemsFor>;
  renameSubmit: (entry: FileEntry, name: string) => void;
  renameCancel: () => void;
  drop: FolderDropHandlers;
};

export type RowProps = {
  entry: FileEntry;
  top: number;
  selected: boolean;
  cut: boolean;
  renaming: boolean;
  dropTarget: boolean;
  windowFocused: boolean;
  tags: TagColor[];
  handlers: RowHandlers;
};

export type ColumnPaneProps = {
  column: Column;
  /** Položky k vykreslení — po případném filtru, proto ne column.entries. */
  entries: FileEntry[];
  index: number;
  isFocused: boolean;
  windowFocused: boolean;
  onSelect: (columnIndex: number, entry: FileEntry, mods?: SelectMods) => void;
  onOpen: (columnIndex: number, entry: FileEntry) => void;
  onDropInto: DropInto;
  onBandStart: (columnIndex: number, additive: boolean) => void;
  onBandSelect: (columnIndex: number, paths: string[]) => void;
  onFocus: (columnIndex: number) => void;
  onContextMenu?: (entry: FileEntry, x: number, y: number) => void;
  cutPaths: Set<string>;
  renamingPath: string | null;
  onRenameSubmit: (entry: FileEntry, name: string) => void;
  onRenameCancel: () => void;
  tags: TagMap;
  onClearSelection: (index: number) => void;
  /** Sloupec, který se právě zahazuje — jen dohrává odchod, nereaguje. */
  exiting?: boolean;
  /** Jak doscrollovat na výběr posunutý klávesnicí — "smooth" jen pro
   *  PgUp/PgDn. Sdílený ref; sloupec si hodnotu po použití vrátí na "auto". */
  scrollBehavior: { current: ScrollBehavior };
  /** Kam byl sloupec odscrollovaný (sdílená paměť view, klíč index/cesta).
   *  Odcházející kopie z ní převezme pozici, ať při zhasínání neskočí nahoru. */
  scrollMemory: Map<string, number>;
  memoryKey: string;
};

export type InfoPanelProps = {
  entry: FileEntry;
  onOpen: (entry: FileEntry) => void;
  tags: TagMap;
  /** MI-FORK: klik na náhled obrázku otevře velký náhled (mezerník). */
  onPreview?: () => void;
};

export type ColumnViewProps = {
  api: ColumnsApi;
  windowFocused: boolean;
  onOpenFile: (entry: FileEntry) => void;
  cutPaths: Set<string>;
  renamingPath: string | null;
  onRenameSubmit: (entry: FileEntry, name: string) => void;
  onRenameCancel: () => void;
  onContextMenu?: (entry: FileEntry, x: number, y: number) => void;
  tags: TagMap;
  /** Menu, dialog nebo přejmenování drží fokus u sebe. Po jejich zavření se
   *  fokus vrací sloupcům — jinak by šipky byly mrtvé do dalšího kliku. */
  suspended: boolean;
  onDropInto: DropInto;
};
