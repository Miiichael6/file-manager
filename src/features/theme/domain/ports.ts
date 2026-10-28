/** Co okno kreslí pod obsahem: plné pozadí (vypnuto), nebo Acrylic (rozmazaná plocha). */
export type WindowBackdrop = "off" | "acrylic";

/** Nativní okno aplikace: podklad, barva pozadí, aktivita a ukázání po startu. */
export interface WindowChrome {
  /** Efekty průhlednosti ve Windows zapnuté (registr). */
  systemTransparency(): Promise<boolean>;
  /** Umí Windows Acrylic (Windows 11 22H2+)? */
  acrylicSupported(): Promise<boolean>;
  setBackdrop(backdrop: WindowBackdrop): Promise<void>;
  /** CSS barva; `#00000000` = průhledné okno. */
  setBackgroundColor(color: string): Promise<void>;
  isActive(): Promise<boolean>;
  /** Aktivace/deaktivace okna (WM_NCACTIVATE, snap.rs); vrací odhlášení. */
  onActiveChange(handler: (active: boolean) => void): Promise<() => void>;
  /** První render hotový — okno se smí ukázat. */
  ready(): Promise<void>;
}
