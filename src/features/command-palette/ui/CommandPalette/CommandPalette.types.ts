import type { Command } from "../../domain/commands.types";
import type { TagColor } from "../../../../shared/domain/types";

/** Složka nabízená paletou a odkud se vzala. */
export type PaletteFolder = { path: string; source: "favorite" | "recent" | "tab" | "subfolder" };

export type Category = "all" | "folders" | "actions" | "tags";

export type Result = {
  key: string;
  category: Exclude<Category, "all"> | "files";
  title: string;
  detail?: string;
  shortcut?: string;
  icon: React.ReactNode;
  score: number;
  run: () => void;
};

/** Akce mimo registr příkazů, které vznikají za běhu (typy z menu Nový). */
export type PaletteAction = { key: string; title: string; icon: React.ReactNode; run: () => void };

export type CommandPaletteProps = {
  commands: Command[];
  /** Hledají se jen podle zadaného textu, do prázdného pole se nenabízejí. */
  extraActions?: PaletteAction[];
  folders: PaletteFolder[];
  /** Nedávné složky pro prázdné pole (nejnovější první). */
  recentFolders: string[];
  /** Kolikrát se který příkaz spustil (settings.json). */
  usage: Record<string, number>;
  onClose: () => void;
  onOpenFolder: (path: string) => void;
  /** Text, který vypadá jako cesta (C:\…, \\server, ~) — přímý skok. */
  onGoToPath: (text: string) => void;
  onSelectTag: (color: TagColor) => void;
  /** Enter bez výsledku: rekurzivní hledání souborů v aktuální složce. */
  onSearchFiles: (query: string) => void;
  onRunCommand: (command: Command) => void;
};
