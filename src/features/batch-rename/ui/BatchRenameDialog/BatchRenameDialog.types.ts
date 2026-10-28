import type { FileEntry } from "../../../../shared/domain/types";
import type { Preview } from "../../domain/batchRename.types";

export type Props = {
  entries: FileEntry[];
  siblings: FileEntry[];
  onApply: (previews: Preview[]) => void;
  onClose: () => void;
};
