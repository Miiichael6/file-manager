import type { SearchRule } from "../../features/search/domain/searchCriteria.types";
import type {
  ClipboardFiles,
  DeleteReport,
  ElevatedOutcome,
  MediaInfo,
  OnConflict,
  RecycleEntry,
  RecycleState,
  ShellNewType,
  TerminalId,
} from "./fileops";
import type { FavoriteSection, FileEntry, FileProperties, FolderStats, OpResult, StatResult } from "./types";

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
  /** Náhled ze shellu ("none" = typ náhled nemá); chyba přijde jako surové {key, args}. */
  thumbnail(path: string, size: number): Promise<string>;
  /** Ikona typu podle přípony — soubor nemusí existovat. */
  extensionIcon(extension: string): Promise<string>;
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

/** Otevírání přes shell Windows (výchozí aplikace, prohlížeč). */
export interface ShellLauncher {
  /** Soubor ve výchozí aplikaci, odkaz (https:, mailto:) v prohlížeči. */
  open(path: string): Promise<void>;
  /** Stránka vydání na GitHubu (Rust ověří, že jde o ni). */
  openReleasePage(url: string): Promise<void>;
  openInExplorer(path: string): Promise<void>;
  /** Systémový dialog „Otevřít v aplikaci". */
  openWith(path: string): Promise<void>;
  /** Terminál ve složce — u souboru v té jeho. */
  openTerminal(path: string, terminal: TerminalId | "auto"): Promise<void>;
  /** Nainstalované terminály. */
  availableTerminals(): Promise<TerminalId[]>;
  /** Telefon nebo fotoaparát (shellová cesta) — prohlížet ho umí jen Průzkumník. */
  openDevice(path: string): Promise<void>;
}

/** Hlídání změn ve složkách (watcher v main.rs). */
export interface DirWatcher {
  /** Nahradí hlídané složky; `generation` zahodí zpožděné události starého volání. */
  watch(paths: string[], generation: number): Promise<void>;
  /** Něco se v hlídané složce změnilo; vrací, jak přestat poslouchat. */
  onChange(handler: () => void): Promise<() => void>;
}

/** Místa systému: sekce sidebaru (známé složky, jednotky), domovská složka, volby Průzkumníku. */
export interface SystemPlaces {
  favorites(): Promise<FavoriteSection[]>;
  /** Připojení nebo odpojení jednotky. */
  onDrivesChanged(handler: () => void): Promise<() => void>;
  homeDir(): Promise<string>;
  /** Průzkumník ukazuje skryté soubory (výchozí stav pro aplikaci). */
  explorerShowsHidden(): Promise<boolean>;
}

/** Adresa, přes kterou webview načte místní soubor (obrázek, video, PDF). */
export interface FileUrls {
  assetUrl(path: string): string;
}

/** Souborové operace (main.rs, fileop.rs). `copyLabel` = slovo „kopie" v jazyce UI. */
export interface FileOperations {
  rename(from: string, toName: string): Promise<string>;
  renameElevated(from: string, toName: string): Promise<string>;
  /** Celý výběr jednou operací shellu — do Koše, nebo trvale; `elevate` = jako správce (UAC). */
  delete(paths: string[], permanent: boolean, elevate: boolean): Promise<DeleteReport>;
  copy(from: string, toDir: string, onConflict: OnConflict, copyLabel: string): Promise<OpResult>;
  move(from: string, toDir: string, onConflict: OnConflict, copyLabel: string): Promise<OpResult>;
  duplicate(path: string, copyLabel: string): Promise<OpResult>;
  /** Kopírování / přesun jako správce (UAC). */
  transferElevated(
    items: { from: string; onConflict: OnConflict }[],
    toDir: string,
    mode: "copy" | "move",
    copyLabel: string,
  ): Promise<ElevatedOutcome[]>;
  /** Vytvoří složku a vrátí její cestu (název se při kolizi očísluje). */
  createFolder(dir: string, name: string): Promise<string>;
  createFolderElevated(dir: string, name: string): Promise<string>;
  createFile(dir: string, name: string): Promise<string>;
  /** Typy pro menu Nový (registr ShellNew). */
  shellNewTypes(): Promise<ShellNewType[]>;
  /** Nový soubor typu `extension` jménem `name` (bez přípony); vrátí cestu. */
  createShellNew(dir: string, extension: string, name: string): Promise<string>;
  /** Zpět u smazání: vrátí položky z Koše (smazané v `deletedSince` a později). */
  restoreFromTrash(paths: string[], deletedSince: number): Promise<void>;
  /** Smaže se některá z cest trvale? (Svazek bez Koše — flashka, síť.) */
  trashIsPermanent(paths: string[]): Promise<boolean>;
  stat(paths: string[]): Promise<StatResult[]>;
  properties(path: string): Promise<FileProperties>;
  mediaInfo(path: string): Promise<MediaInfo>;
  /** Velikost a počet položek složky; mezisoučty chodí do `onProgress`. */
  folderStats(path: string, requestId: number, onProgress: (stats: FolderStats) => void): Promise<FolderStats>;
  cancelFolderStats(requestId: number): Promise<void>;
  /** Hledání v podsložkách; s `criteria` se `query` nepoužije. */
  search(
    root: string,
    query: string,
    maxResults: number,
    showHidden: boolean,
    searchId: number,
    criteria: SearchRule[] | null,
  ): Promise<FileEntry[]>;
  cancelSearch(searchId: number): Promise<void>;
}

/** Soubory ve schránce Windows (CF_HDROP, clipboard.rs). */
export interface FileClipboard {
  writeFiles(paths: string[], cut: boolean): Promise<void>;
  /** null = ve schránce nejsou soubory (text, obrázek, nic). */
  readFiles(): Promise<ClipboardFiles | null>;
  hasFiles(): Promise<boolean>;
  clear(): Promise<void>;
}

/** Koš přes Shell API (recycle.rs); položky se určují podle `id`. */
export interface RecycleBin {
  state(): Promise<RecycleState>;
  list(): Promise<RecycleEntry[]>;
  /** Zpět na původní místo (to zná Koš); obsazené místo se nepřepisuje. */
  restore(ids: string[], elevate: boolean): Promise<DeleteReport>;
  purge(ids: string[], elevate: boolean): Promise<DeleteReport>;
  empty(): Promise<void>;
}
