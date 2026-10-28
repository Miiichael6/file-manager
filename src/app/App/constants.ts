import type { TerminalId } from "../../shared/application/fileops";
import type { SortKey } from "../../shared/domain/format.types";
import type { MessageKey } from "../../shared/i18n/index.types";
import type { ViewMode } from "../../shared/domain/types";

/** Užší okno rozdělení schová (stav zůstává a vrátí se po zvětšení). */
export const SPLIT_MIN_WIDTH = 1000;

export const VIEW_LABELS: Record<ViewMode, MessageKey> = {
  icon: "view.icons",
  list: "view.list",
  column: "view.columns",
};

export const SORT_LABELS: Record<SortKey, MessageKey> = {
  name: "sort.name",
  modified: "sort.modified",
  size: "sort.size",
  kind: "sort.kind",
};

/** Popisky terminálů (menu Více → Terminál a podmenu Shift+klik). */
export const TERMINAL_LABELS: Record<TerminalId, MessageKey> = {
  windowsTerminal: "terminal.windowsTerminal",
  pwsh: "terminal.pwsh",
  powershell: "terminal.powershell",
  cmd: "terminal.cmd",
};
