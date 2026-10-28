import type { cs } from "./cs";

/** Plurál v angličtině: one = 1, other = všechno ostatní (Intl.PluralRules("en")). */
export type EnPlural = { one: string; other: string };

/** Každý klíč z cs.ts — chybějící nebo navíc shodí build; plurál zůstává plurálem. */
export type Dictionary = { [K in keyof typeof cs]: (typeof cs)[K] extends string ? string : EnPlural };
