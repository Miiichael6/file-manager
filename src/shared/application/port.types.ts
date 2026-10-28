/**
 * Port = rozhraní, přes které aplikační vrstva mluví s okolím (backend Tauri,
 * schránka, okno…). Aplikace zná jen rozhraní; konkrétní adaptér dosadí kořen
 * kompozice `src/app/composition` ještě před prvním renderem. Testy můžou
 * dosadit vlastní náhradu přes `provide`.
 */
export type Port<T> = {
  readonly name: string;
  /** Dosazený adaptér; bez něj vyhodí chybu (chybí v kořeni kompozice). */
  get(): T;
  provide(adapter: T): void;
};
