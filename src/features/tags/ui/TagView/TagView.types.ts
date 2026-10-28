import type { FileEntry, TagColor } from "../../../../shared/domain/types";

export type TagViewProps = {
  color: TagColor;
  windowFocused: boolean;
  selectedPath: string | null;
  onSelectionChange: (entry: FileEntry | null) => void;
  onOpen: (entry: FileEntry) => void;
  /** Pravý klik — stejné menu jako u běžné položky. */
  onContextMenu: (entry: FileEntry, x: number, y: number) => void;
  /** Roste po každé souborové operaci; výsledky se pak načtou znovu. */
  refreshToken: number;
  /** Ať status bar hlásí počet z tag view, ne z podkladové složky. */
  onCountChange: (count: number) => void;
};
