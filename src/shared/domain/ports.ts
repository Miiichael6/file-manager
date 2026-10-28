import type { FileEntry } from "./types";

/** Sdílené porty — rozhraní, která používá víc funkcí aplikace. */

/** Požadavek na výpis po dávkách; `token` odliší dávky souběžných výpisů. */
export type DirStreamRequest = { path: string; showHidden: boolean; token: number; slot: number };

/** Běžící výpis po dávkách: `finished` doběhne po odpovědi (chyba = výpis selhal). */
export type DirStream = { finished: Promise<void>; stop(): void };

/** Čtení souborového systému (main.rs). */
export interface FileSystem {
  /** Celý výpis složky najednou (sloupce, strom); hlavní výpis jde proudem přes panel. */
  listDir(path: string, showHidden: boolean): Promise<FileEntry[]>;
  /**
   * Výpis po dávkách: dávky chodí do `onBatch` v pořadí (první = odpověď,
   * pak zbytek); `last` = výpis je kompletní.
   */
  listDirStream(request: DirStreamRequest, onBatch: (entries: FileEntry[], last: boolean) => void): DirStream;
  /** Volné místo na svazku složky (bajty). */
  diskFreeSpace(path: string): Promise<number>;
  /** Jde obsah složky vypsat? Chyba = ne (s důvodem). */
  canList(path: string): Promise<void>;
  /** Začátek textového souboru (náhled, porovnání). */
  readText(path: string, maxBytes: number): Promise<{ text: string; truncated: boolean }>;
}

/** Obrázky ze shellu Windows (data URL, s cache na disku v Rustu). */
export interface ShellImages {
  /** Ikona souboru nebo .exe v dané velikosti (px). */
  fileIcon(path: string, size: number): Promise<string>;
}

/** Vlastní klíče v settings.json (mimo typované nastavení storage.ts). */
export interface SettingsStore {
  /** Uložená hodnota klíče; undefined = chybí. Chyba čtení se hlásí jako undefined. */
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}

/** Textová schránka systému. */
export interface TextClipboard {
  writeText(text: string): Promise<void>;
}

/** Adresa, přes kterou webview načte místní soubor (obrázek, video, PDF). */
export interface FileUrls {
  assetUrl(path: string): string;
}
