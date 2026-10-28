import type { usePanel } from "./panel";

export type PanelOptions = {
  /** 0 = levý, 1 = pravý — backend podle něj drží streamované výpisy zvlášť. */
  slot: number;
  /** null = ještě se neví (nastavení se načítá) — výpis do té doby čeká. */
  showHidden: boolean | null;
  /** Chyby bez vlastního místa v UI (refresh sloupce). */
  setNotice: (text: string | null) => void;
};

export type Panel = ReturnType<typeof usePanel>;
