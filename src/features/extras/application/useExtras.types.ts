import type { FileEntry } from "../../../shared/domain/types";
import type { MessageKey } from "../../../shared/i18n/index.types";
import type { UndoOp } from "../../history/application/undo.types";
import type { MenuItem } from "../../../shared/ui/ContextMenu";

export type ExtrasCommandId = "batchRename" | "compareFiles" | "compressZip" | "extractZip";

export type Options = {
  /** Selección (o la entrada bajo el ratón) del panel activo. */
  targets: FileEntry[];
  /** Todo lo que hay en la carpeta actual (choques al renombrar). */
  siblings: FileEntry[];
  runOperation: (label: MessageKey, action: () => Promise<unknown>) => Promise<void>;
  record: (op: UndoOp) => void;
  requestSelect: (dir: string, path: string) => void;
  showInfo: (text: string) => void;
};

export type SubmenuItem = Extract<MenuItem, { type: "submenu" }>;

/** Vale tanto en un menú como dentro de un submenú. */
export type NestedSubmenu = { type: "submenu"; label: string; items: SubmenuItem["items"] };

export type ActionItem = Extract<MenuItem, { type: "item" }>;
