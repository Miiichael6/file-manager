import type { TagColor } from "../../domain/types";

export type ActionItem = {
  type: "item";
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Přepínač (režim zobrazení, řazení). undefined = obyčejná položka bez háčku. */
  checked?: boolean;
  /** Barevný puntík před názvem (menu Štítky). */
  dot?: string;
  /** Ikona před názvem (16 px) — menu Nový. */
  icon?: React.ReactNode;
  /** Bublina s vysvětlením po najetí (Styl průhlednosti: rozmazaná). */
  tooltip?: string;
  onSelect: () => void;
  /** Shift+klik (Shift+Enter) položku místo spuštění rozbalí na podmenu s těmito
   *  volbami — „Otevřít v terminálu" → všechny dostupné terminály. */
  shiftItems?: SubmenuEntry[];
};

/** Položka podmenu: akce, oddělovač, nebo další podmenu (Zobrazit ▸ Přípony souborů ▸). */
export type SubmenuEntry =
  | { type: "separator" }
  | ActionItem
  | { type: "submenu"; label: string; items: SubmenuEntry[] };

export type MenuItem =
  | { type: "separator" }
  /** Šedý popisek nahoře v menu ("3 položky") — nedá se na něj kliknout. */
  | { type: "header"; label: string }
  | ActionItem
  /** Řádek s paletou barev v podmenu. Klik na barvu menu nezavírá. */
  | {
      type: "tags";
      label: string;
      active: TagColor[];
      onToggle: (color: TagColor) => void;
    }
  /** Řádek, který po najetí rozbalí další seznam (Zobrazit ▸, Seřadit podle ▸). */
  | { type: "submenu"; label: string; disabled?: boolean; items: SubmenuEntry[]; icon?: React.ReactNode };

export type ContextMenuProps = {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  /** Prvky, které menu otevírají a zavírají samy (tlačítka toolbaru). Klik
   *  na ně menu nezavře — jinak by ho posluchač zavřel a klik hned otevřel. */
  triggerSelector?: string;
  /** Rozbalovací menu pod tlačítkem (toolbar): při otevření se rozvine svisle
   *  od tlačítka, ne zvětšením z místa kliknutí. */
  dropdown?: boolean;
};

export type TagRowProps = {
  label: string;
  active: TagColor[];
  onToggle: (color: TagColor) => void;
  /** Podmenu se u pravého okraje musí vyklopit doleva. */
  flip: boolean;
  open: boolean;
  onHover: () => void;
};

export type SubmenuRowProps = {
  label: string;
  icon?: React.ReactNode; // MI-FORK
  disabled?: boolean;
  items: SubmenuEntry[];
  flip: boolean;
  open: boolean;
  highlighted?: boolean;
  onHover: () => void;
  onDone: () => void;
};
