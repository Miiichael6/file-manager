/** Archivy ZIP (mi_extras.rs); obě operace vracejí cestu k výsledku. */
export interface Archives {
  /** Zabalí `paths` do `dir\name`. */
  create(paths: string[], dir: string, name: string): Promise<string>;
  /** Rozbalí archiv vedle něj. */
  extract(path: string): Promise<string>;
}
