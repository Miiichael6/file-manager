/**
 * Odkud se do složky přišlo — podle toho se vybere přechod obsahu:
 * zpět/vpřed posun do strany, vnoření a výstup nahoru zoom, skok jinam
 * (sidebar, zadaná cesta) jen prolnutí.
 */
export type NavDirection = "back" | "forward" | "into" | "up" | "jump";

/** Historie navigace jako dva zásobníky, stejně jako to dělá prohlížeč. */
export type NavState = {
  current: string | null;
  back: string[];
  forward: string[];
  direction: NavDirection;
};

export type NavAction =
  | { type: "go"; path: string }
  | { type: "back" }
  | { type: "forward" }
  /** Přepnutí záložky: celá historie té záložky naráz. */
  | { type: "restore"; state: NavState };
