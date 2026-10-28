/** Nastavení přípon z registru Windows (extensions.rs). */
export interface ExplorerExtensions {
  /** Průzkumník skrývá přípony známých typů (HideFileExt). */
  hidesKnown(): Promise<boolean>;
  /** Pravidla pro přípony (0 neznámý, 1 známý, 2 NeverShowExt, 3 AlwaysShowExt), ve stejném pořadí. */
  rules(extensions: string[]): Promise<number[]>;
}

/** Průběžná velikost složky (mi_extras.rs: folder_sizes). */
export type FolderSizeUpdate = { path: string; bytes: number; done: boolean };

/** Výpočet velikostí složek na pozadí. */
export interface FolderSizes {
  /** Spustí výpočet; průběžné hodnoty chodí do `onSize`. */
  compute(paths: string[], requestId: number, onSize: (update: FolderSizeUpdate) => void): Promise<void>;
  cancel(requestId: number): Promise<void>;
}

/** Nativní tažení ven (native_drag.rs) a soubory puštěné zvenku (external_drop.rs). */
export interface NativeDrag {
  /** Spustí nativní OLE drag s cestami (tlačítko myši je dole). */
  start(paths: string[]): Promise<void>;
  /** Konec nativního tažení, ať drop přišel kamkoli. */
  onEnd(handler: () => void): Promise<() => void>;
  /** Cesty k souborům puštěným zvenku, podle id zprávy z webview. */
  onExternalDrop(handler: (drop: { id: number; paths: string[] }) => void): Promise<() => void>;
}
