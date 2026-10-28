import { compareNames, kindLabel } from "../../../shared/domain/format";
import { t, type MessageKey } from "../../../shared/i18n/index";
import type { FileEntry } from "../../../shared/domain/types";
import type { GroupBy } from "../../extras/application/extrasSettings";

/*
 * MI-FORK: «Agrupar por» en la vista Lista. El orden de los grupos es fijo;
 * dentro de cada grupo se mantiene el orden de la columna elegida (sort estable).
 */

type Group = { key: string; rank: number; label: string };

const DAY = 86_400;

const DATE_GROUPS: MessageKey[] = [
  "extras.group.today",
  "extras.group.yesterday",
  "extras.group.thisWeek",
  "extras.group.thisMonth",
  "extras.group.thisYear",
  "extras.group.older",
  "extras.group.noDate",
];

/** Rangos como los del Explorador (Diminuto, Pequeño, …). */
const SIZE_GROUPS: [number, MessageKey][] = [
  [0, "extras.group.empty"],
  [16 * 1024, "extras.group.tiny"],
  [1024 ** 2, "extras.group.small"],
  [128 * 1024 ** 2, "extras.group.medium"],
  [1024 ** 3, "extras.group.large"],
  [4 * 1024 ** 3, "extras.group.huge"],
  [Infinity, "extras.group.gigantic"],
];

/** Medianoche de hoy en segundos Unix (hora local). */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
}

function dateRank(modified: number, today: number): number {
  if (modified <= 0) return 6;
  if (modified >= today) return 0;
  if (modified >= today - DAY) return 1;
  if (modified >= today - 6 * DAY) return 2;
  const now = new Date();
  const date = new Date(modified * 1000);
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return 3;
  if (date.getFullYear() === now.getFullYear()) return 4;
  return 5;
}

/** Grupo de una entrada. `today` se pasa para no recalcularlo por fila. */
export function groupOf(entry: FileEntry, groupBy: GroupBy, today = startOfToday()): Group {
  switch (groupBy) {
    case "kind":
      return entry.is_dir
        ? { key: "dir", rank: 0, label: t("extras.group.folders") }
        : { key: kindLabel(entry), rank: 1, label: kindLabel(entry) };
    case "date": {
      const rank = dateRank(entry.modified, today);
      return { key: String(rank), rank, label: t(DATE_GROUPS[rank]) };
    }
    case "size": {
      if (entry.is_dir) return { key: "dir", rank: -1, label: t("extras.group.folders") };
      const rank = SIZE_GROUPS.findIndex(([limit]) => entry.size <= limit);
      return { key: String(rank), rank, label: t(SIZE_GROUPS[rank][1]) };
    }
    case "none":
      return { key: "", rank: 0, label: "" };
  }
}

/** Reordena (estable) para que cada grupo quede contiguo. */
export function groupEntries(entries: FileEntry[], groupBy: GroupBy): FileEntry[] {
  if (groupBy === "none") return entries;
  const today = startOfToday();
  const groups = new Map(entries.map((entry) => [entry, groupOf(entry, groupBy, today)]));
  return [...entries].sort((a, b) => {
    const ga = groups.get(a)!;
    const gb = groups.get(b)!;
    // Por tipo: carpetas primero y luego los tipos por orden alfabético.
    return ga.rank - gb.rank || (ga.key === gb.key ? 0 : compareNames(ga.label, gb.label));
  });
}

export type GroupedRow =
  | { type: "header"; key: string; label: string; count: number }
  | { type: "entry"; entry: FileEntry; index: number };

/** Filas para la lista virtual: una cabecera antes de cada grupo. */
export function groupedRows(entries: FileEntry[], groupBy: GroupBy): GroupedRow[] {
  if (groupBy === "none") return entries.map((entry, index) => ({ type: "entry", entry, index }));
  const today = startOfToday();
  const rows: GroupedRow[] = [];
  let header: (GroupedRow & { type: "header" }) | null = null;
  entries.forEach((entry, index) => {
    const group = groupOf(entry, groupBy, today);
    if (header === null || header.key !== group.key) {
      header = { type: "header", key: group.key, label: group.label, count: 0 };
      rows.push(header);
    }
    header.count += 1;
    rows.push({ type: "entry", entry, index });
  });
  return rows;
}
