/** Velikosti, které umí backend (get_file_icon). */
export type IconSize = 32 | 64 | 128;

/** "none" = shell ikonu nedal (timeout, chyba) — zůstává obecná ikona. */
export type Cached = string | "none";

/** Rozjetý požadavek na jednu ikonu. Sdílí ho všechny řádky se stejným klíčem;
 *  když všichni odejdou dřív, než se dostal na řadu, z fronty se vyřadí. */
export type Pending = {
  promise: Promise<Cached | null>;
  subscribers: number;
  /** Vyřadí požadavek z fronty; false = už běží (dojede a uloží se). */
  cancel: () => boolean;
};

/** Velikosti náhledů, které umí backend (get_file_thumbnail). */
export type ThumbnailSize = 64 | 128 | 256;
