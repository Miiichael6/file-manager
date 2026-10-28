/**
 * Doby animací žijí jen v CSS (tokeny --dur-* v index.css, násobené
 * --motion-scale). Kód, který musí na konec animace počkat (odmontování
 * odcházejícího sloupce, zavření dialogu), si dobu přečte odtud — tokeny
 * jsou registrované přes @property jako <time>, takže getComputedStyle vrací
 * už spočítanou hodnotu včetně vypnutých animací (0 ms).
 */
export type MotionToken =
  | "--dur-press"
  | "--dur-quick"
  | "--dur-fade"
  | "--dur-shift"
  | "--dur-nav"
  | "--dur-enter"
  | "--dur-slow"
  | "--dur-zoom";
