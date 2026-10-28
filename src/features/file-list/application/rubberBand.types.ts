export type Rect = { left: number; top: number; width: number; height: number };

export type RubberBandOptions = {
  /** Začátek tažení; `additive` = držený Ctrl / Shift (přidávat k výběru). */
  onStart?: (additive: boolean) => void;
  /** Cesty položek pod obdélníkem, průběžně při každém pohybu. */
  onChange: (paths: string[], additive: boolean) => void;
  /** Zásah počítaný z geometrie (virtualizované výpisy — řádky mimo
   *  obrazovku nejsou v DOM). Bez něj se hledá v DOM podle `data-path`. */
  hitTest?: (box: { left: number; top: number; right: number; bottom: number }) => string[];
};
