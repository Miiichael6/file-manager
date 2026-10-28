import type { cs } from "./cs";

/** Plurál ve španělštině: one = 1, other = všechno ostatní ("many" pro miliony spadne na other). */
export type EsPlural = { one: string; other: string };

/** Každý klíč z cs.ts — chybějící nebo navíc shodí build; plurál zůstává plurálem. */
export type Dictionary = { [K in keyof typeof cs]: (typeof cs)[K] extends string ? string : EsPlural };
