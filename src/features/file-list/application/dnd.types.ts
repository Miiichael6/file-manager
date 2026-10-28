export type DragItem = { path: string; name: string; isDir: boolean };

export type DragPayload =
  /** Položky z hlavního panelu — celý výběr, když se táhne za vybraný řádek. */
  | { kind: "entry"; items: DragItem[] }
  /** Existující vlastní oblíbená — přerovnání v rámci sekce. */
  | { kind: "favorite"; path: string; index: number; isDir?: boolean }
  /** MI-FORK: složka ze sidebaru (Tento počítač, jednotky, nedávné, strom) —
   *  nad plochou panelů se pustí vlevo, vpravo nebo do nové záložky. */
  | { kind: "place"; path: string; name: string };

export type WebView2 = {
  postMessageWithAdditionalObjects?: (message: unknown, objects: ArrayLike<unknown>) => void;
};
