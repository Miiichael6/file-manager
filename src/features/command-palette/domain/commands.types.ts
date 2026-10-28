import type { MessageKey } from "../../../shared/i18n/index.types";

export type CommandId =
  | "palette"
  | "newFolder"
  | "newFile"
  | "newItem"
  | "newTab"
  | "closeTab"
  | "nextTab"
  | "previousTab"
  | "toggleSplit"
  | "separateTabs"
  | "switchPanel"
  | "copyToOther"
  | "moveToOther"
  | "viewIcons"
  | "viewList"
  | "viewColumns"
  | "toggleHidden"
  | "toggleTheme"
  | "themeLight"
  | "themeDark"
  | "themeSystem"
  | "languageSystem"
  | "languageEnglish"
  | "languageCzech"
  | "languageSpanish"
  | "motionSystem"
  | "motionOn"
  | "motionOff"
  | "transparencyOff"
  | "extensionsWindows"
  | "extensionsAlways"
  | "extensionsNever"
  | "toggleTransparency"
  | "transparencySubtle"
  | "transparencyMedium"
  | "transparencyStrong"
  | "transparencyBlur"
  | "terminalAuto"
  | "terminalWindows"
  | "terminalPwsh"
  | "terminalPowerShell"
  | "terminalCmd"
  | "goBack"
  | "goForward"
  | "goParent"
  | "openSelection"
  | "editPath"
  | "find"
  | "advancedSearch"
  | "refresh"
  | "undo"
  | "redo"
  | "copy"
  | "cut"
  | "paste"
  | "duplicate"
  | "selectAll"
  | "rename"
  | "delete"
  | "deletePermanently"
  | "openTrash"
  | "openComputer" // MI-FORK
  | "emptyTrash"
  | "copyPath"
  | "openTerminal"
  | "checkUpdates"
  | "about"
  // MI-FORK: Git integrado.
  | "gitPanel"
  | "gitStage"
  | "gitUnstage"
  | "gitPull"
  | "gitPush"
  // MI-FORK: extras (mi-fork/useExtras.tsx).
  | "batchRename"
  | "compareFiles"
  | "compressZip"
  | "extractZip";

/**
 * Kde smí zkratka běžet:
 * - `global` — vždy, i s fokusem v poli hledání (záložky, paleta),
 * - `overlay` — mimo textová pole, i ve výsledcích hledání a v tag view,
 * - `folder` — jen nad výpisem složky (výchozí; Delete nad výsledky hledání
 *   by mířil na neviditelnou podkladovou složku).
 */
export type CommandScope = "global" | "overlay" | "folder";

/** `code` = fyzická klávesa (nezávislá na rozložení), `key` = znak. */
export type KeyBinding = {
  key?: string;
  code?: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type CommandDefinition = {
  title: MessageKey;
  /** Zkratka, jak se ukazuje v menu a paletě. */
  shortcut?: string;
  keys?: KeyBinding[];
  scope?: CommandScope;
  /** false = jen v menu / klávesou, v paletě ne (Ctrl+Tab apod.). */
  palette?: boolean;
};

/** Co dodává App: akce a stav. `title` přebíjí název (Zpět: Přejmenovat „x"). */
export type CommandHandler = {
  run: () => void;
  enabled?: boolean;
  checked?: boolean;
  title?: string;
};

export type Command = {
  id: CommandId;
  title: string;
  shortcut?: string;
  keys: KeyBinding[];
  scope: CommandScope;
  palette: boolean;
  enabled: boolean;
  checked?: boolean;
  run: () => void;
};

export type Commands = Record<CommandId, Command>;
