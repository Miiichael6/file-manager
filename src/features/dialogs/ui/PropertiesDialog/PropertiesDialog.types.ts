import type { FileEntry } from "../../../../shared/domain/types";

export type PropertiesDialogProps = {
  entry: FileEntry;
  onClose: () => void;
};
