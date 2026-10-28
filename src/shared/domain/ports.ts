import type { FileEntry } from "./types";

/** Sdílené porty — rozhraní, která používá víc funkcí aplikace. */

/** Čtení souborového systému (main.rs). */
export interface FileSystem {
  /** Celý výpis složky najednou (sloupce, strom); hlavní výpis jde proudem přes panel. */
  listDir(path: string, showHidden: boolean): Promise<FileEntry[]>;
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
