import type { MessageKey } from "../../../shared/i18n/index.types";
import { extensionsOfGroups, fileType } from "../../../shared/domain/filetypes";
import type { FileGroup } from "../../../shared/domain/filetypes.types";
import type { CriterionField, CriterionRow, DateOp, DateUnit, KindId, NameOp, SearchRule, SizeOp, SizeUnit } from "./searchCriteria.types";

/**
 * Rozšířené hledání: řádky kritérií, jak je edituje lišta nad výsledky
 * (SearchCriteriaBar), a jejich převod na pravidla pro `search_recursive`.
 * Všechna kritéria platí zároveň (AND).
 */

export const FIELDS: { id: CriterionField; label: MessageKey }[] = [
  { id: "name", label: "criteria.name" },
  { id: "kind", label: "criteria.kind" },
  { id: "modified", label: "criteria.modified" },
  { id: "created", label: "criteria.created" },
  { id: "size", label: "criteria.size" },
];

export const NAME_OPS: { id: NameOp; label: MessageKey }[] = [
  { id: "contains", label: "criteria.contains" },
  { id: "begins", label: "criteria.begins" },
  { id: "ends", label: "criteria.ends" },
  { id: "is", label: "criteria.is" },
];

export const DATE_OPS: { id: DateOp; label: MessageKey }[] = [
  { id: "withinLast", label: "criteria.withinLast" },
  { id: "after", label: "criteria.after" },
  { id: "before", label: "criteria.before" },
];

export const DATE_UNITS: { id: DateUnit; label: MessageKey }[] = [
  { id: "days", label: "criteria.days" },
  { id: "weeks", label: "criteria.weeks" },
  { id: "months", label: "criteria.months" },
  { id: "years", label: "criteria.years" },
];

export const SIZE_OPS: { id: SizeOp; label: MessageKey }[] = [
  { id: "greater", label: "criteria.greater" },
  { id: "less", label: "criteria.less" },
];

export const SIZE_UNITS: SizeUnit[] = ["KB", "MB", "GB"];

const KIND_GROUPS: Record<Exclude<KindId, "folder">, FileGroup[]> = {
  image: ["image"],
  video: ["video"],
  audio: ["audio"],
  document: ["document", "pdf", "text"],
  code: ["code"],
  archive: ["archive"],
  app: ["app"],
};

export const KINDS: { id: KindId; label: MessageKey }[] = [
  { id: "folder", label: "criteria.kindFolder" },
  { id: "image", label: "criteria.kindImage" },
  { id: "video", label: "criteria.kindVideo" },
  { id: "audio", label: "criteria.kindAudio" },
  { id: "document", label: "criteria.kindDocument" },
  { id: "code", label: "criteria.kindCode" },
  { id: "archive", label: "criteria.kindArchive" },
  { id: "app", label: "criteria.kindApp" },
];

/** Popisek formátu přípony — jpg i jpeg jsou oba „JPEG". */
function formatOf(extension: string): string {
  return fileType(extension)?.format ?? extension.toUpperCase();
}

/** Formáty druhu pro druhý výběr (JPEG, PNG…), každý jen jednou. */
export function kindFormats(kind: KindId): string[] {
  if (kind === "folder") return [];
  return [...new Set(extensionsOfGroups(KIND_GROUPS[kind]).map(formatOf))];
}

let nextRowId = 1;

/** Výchozí řádek pro pole — při změně pole se řádek celý nahradí. */
export function newRow(field: CriterionField, value = ""): CriterionRow {
  const id = nextRowId++;
  switch (field) {
    case "name":
      return { id, field, op: "contains", value };
    case "kind":
      return { id, field, kind: "image", format: "" };
    case "modified":
    case "created":
      return { id, field, op: "withinLast", amount: 1, unit: "weeks", date: today() };
    case "size":
      return { id, field, op: "greater", amount: 1, unit: "MB" };
  }
}

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const DAY = 24 * 60 * 60;
const UNIT_SECONDS: Record<DateUnit, number> = { days: DAY, weeks: 7 * DAY, months: 30 * DAY, years: 365 * DAY };
const UNIT_BYTES: Record<SizeUnit, number> = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

/** Začátek dne `yyyy-mm-dd` v místním čase, unix sekundy. */
function dayStart(date: string): number | null {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Math.floor(new Date(year, month - 1, day).getTime() / 1000);
}

/**
 * Řádky → pravidla pro backend. Neúplné řádky (prázdný název, nesmyslné
 * číslo) se vynechají; relativní data se počítají od `now` (unix sekundy).
 */
export function compileCriteria(rows: CriterionRow[], now = Math.floor(Date.now() / 1000)): SearchRule[] {
  const rules: SearchRule[] = [];
  for (const row of rows) {
    switch (row.field) {
      case "name":
        if (row.value.trim() !== "") rules.push({ type: "name", op: row.op, value: row.value.trim() });
        break;
      case "kind": {
        if (row.kind === "folder") {
          rules.push({ type: "kind", folder: true, extensions: [] });
          break;
        }
        const extensions = extensionsOfGroups(KIND_GROUPS[row.kind]).filter(
          (extension) => row.format === "" || formatOf(extension) === row.format,
        );
        rules.push({ type: "kind", folder: false, extensions });
        break;
      }
      case "modified":
      case "created": {
        if (row.op === "withinLast") {
          if (!(row.amount > 0)) break;
          rules.push({ type: row.field, after: now - row.amount * UNIT_SECONDS[row.unit], before: null });
          break;
        }
        const start = dayStart(row.date);
        if (start === null) break;
        // „Po" = od následujícího dne, „před" = do začátku zadaného dne.
        rules.push(
          row.op === "after"
            ? { type: row.field, after: start + DAY, before: null }
            : { type: row.field, after: null, before: start },
        );
        break;
      }
      case "size": {
        if (!(row.amount >= 0)) break;
        const bytes = Math.round(row.amount * UNIT_BYTES[row.unit]);
        rules.push(
          row.op === "greater"
            ? { type: "size", min: bytes, max: null }
            : { type: "size", min: null, max: bytes },
        );
        break;
      }
    }
  }
  return rules;
}
