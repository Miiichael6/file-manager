import type { MessageKey } from "../i18n/index.types";

/** Skupina určuje ikonu a její barvu (icons.tsx). */
export type FileGroup =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "code"
  | "text"
  | "document"
  | "archive"
  | "app"
  | "other";

export type PreviewKind = "image" | "pdf" | "markdown" | "text" | "video" | "audio" | "other";

/**
 * `kind` je klíč do slovníku (sloupec Druh), `format` parametr {format}
 * v něm — "Obrázek {format}" / "{format} Image" → "Obrázek JPEG" / "JPEG Image".
 */
export type FileType = { kind: MessageKey; format?: string; group: FileGroup; preview: PreviewKind };
