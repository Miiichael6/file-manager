import { isValidFileName, parentPath } from "../../../shared/domain/paths";
import type { FileEntry } from "../../../shared/domain/types";
import type { Preview, RenameOptions, Renamed, Status } from "./batchRename.types";

/*
 * MI-FORK: renombrado por lotes. Cálculo de los nombres nuevos (reemplazar o
 * patrón con numeración), validación para la vista previa y ejecución en dos
 * fases cuando los nombres se cruzan (a→b, b→a) — esa está en application/renameAll.ts.
 */

function split(entry: FileEntry): [string, string] {
  const dot = entry.name.lastIndexOf(".");
  return entry.is_dir || dot <= 0 ? [entry.name, ""] : [entry.name.slice(0, dot), entry.name.slice(dot)];
}

function isoDate(modified: number): string {
  if (modified <= 0) return "";
  const date = new Date(modified * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nombres nuevos y su estado. `siblings` = todo lo que hay en la carpeta. */
export function previewRename(entries: FileEntry[], siblings: FileEntry[], options: RenameOptions): Preview[] {
  let matcher: RegExp | null = null;
  if (options.mode === "replace" && options.find !== "") {
    try {
      const source = options.regex ? options.find : escapeRegExp(options.find);
      matcher = new RegExp(source, options.matchCase ? "g" : "gi");
    } catch {
      return entries.map((entry) => ({ entry, next: entry.name, status: "badRegex" }));
    }
  }

  const names = entries.map((entry, index) => {
    const [stem, ext] = split(entry);
    if (options.mode === "replace") {
      if (matcher === null) return entry.name;
      if (options.includeExt) return entry.name.replace(matcher, options.replace);
      return stem.replace(matcher, options.replace) + ext;
    }
    const number = String(options.start + index).padStart(Math.max(1, options.pad), "0");
    const body = options.pattern
      .replace(/\[name\]/gi, stem)
      .replace(/\[n\]/gi, number)
      .replace(/\[date\]/gi, isoDate(entry.modified));
    return body + ext;
  });

  // Lo que se queda en la carpeta: hermanos fuera del lote (los del lote dejan libre su nombre).
  const batch = new Set(entries.map((entry) => entry.path.toLowerCase()));
  const taken = new Set(siblings.filter((s) => !batch.has(s.path.toLowerCase())).map((s) => s.name.toLowerCase()));
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name.trim().toLowerCase(), (counts.get(name.trim().toLowerCase()) ?? 0) + 1);

  return entries.map((entry, index) => {
    const next = names[index].trim();
    const key = next.toLowerCase();
    let status: Status = "ok";
    if (next === entry.name) status = "same";
    else if (!isValidFileName(next) || next === "." || next === "..") status = "invalid";
    else if ((counts.get(key) ?? 0) > 1) status = "duplicate";
    else if (taken.has(key)) status = "exists";
    return { entry, next, status };
  });
}

/** Destino completo de una vista previa. */
export function targetOf(preview: Preview): Renamed {
  const dir = parentPath(preview.entry.path) ?? "";
  return { from: preview.entry.path, to: `${dir.replace(/\\$/, "")}\\${preview.next}` };
}
