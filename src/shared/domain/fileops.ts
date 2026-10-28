import type { BackendError } from "./backendError.types";
import type { OpResult } from "./types";

/** Typy výsledků souborových operací (Rust main.rs, fileop.rs, recycle.rs). */

/**
 * Položka, kterou se nepodařilo zpracovat: `path` = kde to selhalo (u složky
 * i soubor uvnitř), `item` = vybraná položka, `admin` = pomohlo by oprávnění správce.
 */
export type ItemFailure = { path: string; item: string; error: BackendError; admin: boolean };
export type DeleteReport = { deleted: string[]; failed: ItemFailure[] };

/** Výsledek položky z transferElevated: buď `result`, nebo `failure`. */
export type ElevatedOutcome = { result: OpResult | null; failure: ItemFailure | null };

/** Co dělat s kolizí jména v cíli: ponechat obě, nahradit (složku sloučit), přeskočit. */
export type OnConflict = "rename" | "replace" | "skip";

/** Terminál, který se dá spustit (bez `auto`). */
export type TerminalId = "windowsTerminal" | "pwsh" | "powershell" | "cmd";

/** Typ z nabídky Průzkumníku Nový ▸ (registr ShellNew). */
export type ShellNewType = {
  extension: string;
  /** Popisek v menu („Dokument Microsoft Wordu"). */
  name: string;
  /** Název nového souboru z registru (ItemName), jinak „Nový <name>". */
  itemName: string | null;
};

/** Soubory ve schránce Windows (CF_HDROP); `cut` = vyjmuté přes Ctrl+X. */
export type ClipboardFiles = { paths: string[]; cut: boolean };

/** Délka, rozlišení / rozměry a počet stran z Windows property systemu.
 *  Co soubor nemá, je null. */
export type MediaInfo = {
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  pages: number | null;
  // MI-FORK: hudba, video, fotka.
  title: string | null;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  /** bit/s */
  bitrate: number | null;
  sample_rate: number | null;
  channels: number | null;
  /** Snímky za 1000 s. */
  frame_rate: number | null;
  camera: string | null;
  /** Unix ms. */
  taken: number | null;
  iso: number | null;
  f_number: number | null;
  /** Sekundy. */
  exposure: number | null;
  /** mm */
  focal_length: number | null;
};

/** Položka v Koši. `id` = cesta v `$Recycle.Bin` (podle ní se najde znovu). */
export type RecycleEntry = {
  id: string;
  name: string;
  original_dir: string;
  /** Unix sekundy. */
  deleted: number;
  size: number;
  is_dir: boolean;
  extension: string | null;
};

export type RecycleState = { count: number; size: number };
