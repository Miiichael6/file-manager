import type { RecycleEntry } from "../../../../shared/application/fileops";

export type SortKey = "name" | "original" | "deleted" | "size";

export type RecycleBinViewProps = {
  windowFocused: boolean;
  /** Roste po každé souborové operaci; obsah Koše se pak načte znovu. */
  refreshToken: number;
  /** Ať status bar hlásí počet položek Koše, ne podkladové složky. */
  onCountChange: (count: number) => void;
  onRestore: (items: RecycleEntry[]) => void;
  onPurge: (items: RecycleEntry[]) => void;
  onEmpty: () => void;
};
