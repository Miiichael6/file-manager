import type { FileEntry, SelectMods } from "../../../shared/domain/types";
import type { SortDirection, SortKey } from "../../../shared/domain/format.types";

export type Column = {
  path: string;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  /** Aktivní položka — ta, na které stojí klávesnice a kterou otevírá Enter. */
  selectedPath: string | null;
  /** Vícenásobný výběr (Ctrl/Shift+klik, gumička). Prázdné = jen selectedPath. */
  selectedPaths: string[];
  /** Kotva pro Shift: poslední položka vybraná bez Shiftu. */
  anchorPath: string | null;
  /** Identita posledního požadavku na výpis. Odpověď s jiným tokenem je stará
   *  (klik na složku a hned Enter spustí dva loady téhož sloupce) a zahodí se. */
  token: number;
  /** Roste s každým dorazivším výpisem. Podle ní App pozná, že sloupec má
   *  čerstvá data a může v něm označit nově vytvořenou položku. */
  version: number;
};

/** Sloupec uložený v neaktivní záložce — jen cesta a výběr, data se načtou znovu. */
export type ColumnSnapshot = { path: string; selectedPath: string | null; selectedPaths: string[] };

/** Posun o počet řádků (šipky ±1, PgUp/PgDn o stránku) nebo na kraj. */
export type MoveTarget = number | "first" | "last";

export type ColumnsApi = {
  columns: Column[];
  focusedIndex: number;
  /** Cesta nejhlubšího sloupce — to je "kde uživatel je", když se přepíná view mode. */
  activePath: string | null;
  /** Načítá se nový kořen (navigace). Dosavadní sloupce do té doby zůstávají. */
  rootLoading: boolean;
  /** Klik na položku: vybere ji a u složky rovnou natáhne sloupec napravo.
   *  S modifikátory přepíná (Ctrl) nebo vybírá rozsah od kotvy (Shift). */
  select: (columnIndex: number, entry: FileEntry, mods?: SelectMods) => void;
  /** Shift+↑/↓: rozšíří výběr od kotvy v zaměřeném sloupci. */
  extend: (delta: 1 | -1) => void;
  /** Gumička: začátek tažení (additive = Ctrl/Shift, přidává k výběru). */
  startBand: (columnIndex: number, additive: boolean) => void;
  /** Gumička: položky pod obdélníkem. */
  bandSelect: (columnIndex: number, paths: string[]) => void;
  /** Šipka vpravo / Enter nad složkou: otevře ji a přesune fokus do nového sloupce. */
  openInto: (columnIndex: number, entry: FileEntry) => void;
  focusColumn: (columnIndex: number) => void;
  move: (target: MoveTarget) => void;
  /** Klik do prázdna / Escape: zruší výběr ve sloupci a zahodí sloupce napravo. */
  clearSelection: (columnIndex: number) => void;
  /** Přenačte obsah všech otevřených sloupců beze změny hierarchie. */
  refresh: () => void;
  /** Položky sloupce tak, jak je uživatel vidí — seřazené a v zaměřeném
   *  sloupci i vyfiltrované. Šipky i akce pracují jen nad nimi. */
  visibleEntries: (columnIndex: number) => FileEntry[];
  /** Přepnutí záložky: otevře celou hierarchii sloupců i s výběry naráz. */
  restore: (chain: ColumnSnapshot[], focusedIndex: number) => void;
};

export type ColumnSort = { key: SortKey; direction: SortDirection };
