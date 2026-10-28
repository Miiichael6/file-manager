import type { NavDirection } from "../../../features/navigation/application/navigation.types";

export type ViewTransitionProps = {
  /** Identita obsahu (cesta složky). Změna = nový obsah přijede podle směru. */
  id: string | null;
  /** null = beze změny obsahu (přenačtení, přepnutí view) — nic se nehýbe. */
  direction: NavDirection | null;
  /** Kam obsah po výměně odscrollovat (návrat zpět drží původní místo). */
  scrollTop: number;
  /** Starý obsah čekající na výměnu — vidět je, ale nereaguje. */
  inert?: boolean;
  children: React.ReactNode;
};
