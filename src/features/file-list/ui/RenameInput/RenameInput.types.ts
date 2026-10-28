import type { FileEntry } from "../../../../shared/domain/types";

export type RenameInputProps = {
  entry: FileEntry;
  onSubmit: (entry: FileEntry, name: string) => void;
  onCancel: () => void;
  /** row = řádek seznamu a sloupce, icon = název pod ikonou (na střed). */
  variant?: "row" | "icon";
};
