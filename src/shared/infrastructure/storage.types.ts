import type { CustomFavorite, RecentEntry, TagMap, ViewMode } from "../domain/types";
import type { SortDirection, SortKey } from "../domain/format.types";
import type { ThemePreference } from "../../features/theme/application/theme.types";

/** Animace: podle systému (omezit animace ve Windows), vždy, nebo nikdy. */
export type MotionPreference = "system" | "on" | "off";

/** Přípony souborů: podle Windows (jako Průzkumník), vždy, nebo nikdy (lib/extensions.ts). */
export type ExtensionMode = "windows" | "always" | "never";

/** Síla průhlednosti okna (menu Více → Vzhled, paleta). */
export type TransparencyStrength = "subtle" | "medium" | "strong";

/** Jazyk UI: podle systému, nebo napevno (viz i18n/index.ts). */
export type LanguagePreference = "system" | "en" | "cs" | "es";

/** Terminál pro „Otevřít v Terminálu": auto = Windows Terminal, jinak PowerShell. */
/** `pwsh` = PowerShell 7, `powershell` = Windows PowerShell 5.1. */
export type TerminalPreference = "auto" | "windowsTerminal" | "pwsh" | "powershell" | "cmd";

/** Jeden panel uložené záložky: složka, zobrazení a řazení. */
export type SavedPanel = { path: string; view: ViewMode; sortKey: SortKey; sortDirection: SortDirection };

/** Záložky z minulého spuštění. Rozdělená záložka má i pravý panel. */
export type SavedTab = SavedPanel & { second?: SavedPanel; activePanel?: 0 | 1 };

export type SavedTabs = { items: SavedTab[]; active: number };

/** Kontrola aktualizací: zapnutá?, kdy naposled (ms) a co našla. */
export type UpdateSettings = {
  check: boolean;
  lastCheck: number;
  latest: { version: string; url: string } | null;
};

export type Snapshot = {
  favorites: CustomFavorite[];
  recents: RecentEntry[];
  tags: TagMap;
  /** null = uživatel přepínač ještě nezměnil, platí nastavení Průzkumníku. */
  showHidden: boolean | null;
  sidebarWidth: number;
  motion: MotionPreference;
  extensionMode: ExtensionMode;
  language: LanguagePreference;
  /** Vzhled (menu Více → Vzhled); výchozí podle Windows. */
  theme: ThemePreference;
  /** Menu Více → Terminál. */
  terminal: TerminalPreference;
  tabs: SavedTabs;
  updates: UpdateSettings;
  /** Poměr šířky levého panelu v rozděleném okně (0,25–0,75). */
  splitRatio: number;
  /** Kolikrát se který příkaz spustil — paleta z toho ukazuje nejpoužívanější. */
  commandUsage: Record<string, number>;
  /** Průhledné okno (plocha za aplikací prosvítá); výchozí vypnuto. */
  windowTransparency: boolean;
  transparencyStrength: TransparencyStrength;
};

/** Co se nepovedlo — text k tomu dodá App přes i18n (storage na i18n
 *  nezávisí, i18n naopak čte jazyk odsud). */
export type StorageErrorKind = "load" | "save";

export type ErrorListener = (kind: StorageErrorKind, detail: string) => void;
