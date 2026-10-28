export type NameOp = "contains" | "begins" | "ends" | "is";

export type DateOp = "withinLast" | "after" | "before";

export type DateUnit = "days" | "weeks" | "months" | "years";

export type SizeOp = "greater" | "less";

export type SizeUnit = "KB" | "MB" | "GB";

export type KindId = "folder" | "image" | "video" | "audio" | "document" | "code" | "archive" | "app";

export type CriterionField = "name" | "kind" | "modified" | "created" | "size";

export type CriterionRow =
  | { id: number; field: "name"; op: NameOp; value: string }
  /** `format` = "" pro jakýkoli formát, jinak jeho popisek (JPEG, PNG…). */
  | { id: number; field: "kind"; kind: KindId; format: string }
  | {
      id: number;
      field: "modified" | "created";
      op: DateOp;
      amount: number;
      unit: DateUnit;
      /** yyyy-mm-dd pro „po" / „před". */
      date: string;
    }
  | { id: number; field: "size"; op: SizeOp; amount: number; unit: SizeUnit };

/**
 * Hledání v panelu. Bez `criteria` je to prosté hledání podle názvu z pole
 * v toolbaru; s nimi rozšířené (lišta kritérií nad výsledky).
 */
export type PanelSearch = { root: string; query: string; criteria?: CriterionRow[] };

/** Pravidlo, jak ho čte Rust (`SearchRule` v main.rs). */
export type SearchRule =
  | { type: "name"; op: NameOp; value: string }
  | { type: "kind"; folder: boolean; extensions: string[] }
  | { type: "modified" | "created"; after: number | null; before: number | null }
  | { type: "size"; min: number | null; max: number | null };
