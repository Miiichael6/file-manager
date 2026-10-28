import type { TagColor } from "../../../shared/domain/types";

/** Položka před operací a po ní. */
export type Moved = { from: string; to: string };

export type UndoOp =
  | { kind: "rename"; from: string; to: string }
  | { kind: "move"; items: Moved[] }
  /** Kopie i duplikace: `to` je nově vzniklá položka. */
  | { kind: "copy"; items: Moved[] }
  /** `shellNew` = přípona typu z menu Nový — Znovu vytvoří soubor se stejným obsahem. */
  | { kind: "create"; path: string; folder: boolean; shellNew?: string }
  /** `since` = unix sekundy těsně před smazáním — podle nich se hledá v Koši. */
  | { kind: "trash"; paths: string[]; since: number }
  | { kind: "tags"; before: Record<string, TagColor[]>; after: Record<string, TagColor[]> }
  // MI-FORK: renombrado por lotes (mi-fork/batchRename.ts).
  | { kind: "renameMany"; items: Moved[] };
