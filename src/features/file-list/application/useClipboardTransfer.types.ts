import type { Dispatch, SetStateAction } from "react";
import type { Clipboard, FileEntry, TagColor } from "../../../shared/domain/types";
import type { ConflictAnswer, ConflictRequest } from "../../dialogs/ui/ConflictDialog";
import type { MessageKey } from "../../../shared/i18n/index.types";
import type { UndoOp } from "../../history/application/undo.types";
import type { ItemFailure } from "../../../shared/application/fileops";
import type { Panel } from "../../navigation/application/panel.types";
import type { PanelSearch } from "../../search/domain/searchCriteria.types";

export type UseClipboardTransferOptions = {
  setNotice: (text: string | null, detail?: string) => void;
  setClipboard: Dispatch<SetStateAction<Clipboard | null>>;
  targetEntries: FileEntry[];
  setClipboardHasItems: Dispatch<SetStateAction<boolean>>;
  askConflict: (request: ConflictRequest) => Promise<ConflictAnswer | null>;
  runBatch: <T>(label: MessageKey, items: T[], action: (item: T) => Promise<unknown>) => Promise<{ ok: number; failed: number; }>;
  record: (op: UndoOp) => void;
  noteSkippedLinks: (count: number) => void;
  askAdmin: (paths: string[], retry: () => void) => void;
  runOperation: (label: MessageKey, action: () => Promise<unknown>) => Promise<void>;
  reportFailures: (label: MessageKey, failed: ItemFailure[], count: number) => void;
  currentDir: string | null;
  clipboard: Clipboard | null;
  otherPanel: Panel | null;
  search: PanelSearch | null;
  tagFilter: TagColor | null;
  trashView: boolean;
};
