import type { FileEntry } from "../../../shared/domain/types";

export type Group = { key: string; rank: number; label: string };

export type GroupedRow =
  | { type: "header"; key: string; label: string; count: number }
  | { type: "entry"; entry: FileEntry; index: number };
