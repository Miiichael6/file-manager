import { isValidFileName, parentPath, renamePath } from "../fileops";
import * as storage from "../lib/storage";
import type { FileEntry } from "../types";

/*
 * MI-FORK: renombrado por lotes. Cálculo de los nombres nuevos (reemplazar o
 * patrón con numeración), validación para la vista previa y ejecución en dos
 * fases cuando los nombres se cruzan (a→b, b→a).
 */

export type ReplaceOptions = {
  mode: "replace";
  find: string;
  replace: string;
  regex: boolean;
  matchCase: boolean;
  /** También la extensión (si no, solo el nombre sin ella). */
  includeExt: boolean;
};

export type PatternOptions = {
  mode: "pattern";
  /** [name] = nombre sin extensión, [n] = número, [date] = fecha de modificación
   *  (corchetes y no llaves: en los textos de t() las llaves son parámetros). */
  pattern: string;
  start: number;
  /** Cifras mínimas del número (relleno con ceros). */
  pad: number;
};

export type RenameOptions = ReplaceOptions | PatternOptions;

export type Status = "same" | "ok" | "invalid" | "duplicate" | "exists" | "badRegex";
export type Preview = { entry: FileEntry; next: string; status: Status };

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

export type Renamed = { from: string; to: string };

/**
 * Renombra cada `from` a `to` (rutas completas en la misma carpeta). Si algún
 * nombre nuevo es el viejo de otro elemento del lote, todo pasa antes por un
 * nombre temporal. Devuelve lo que se hizo (para Deshacer), aunque falle a medias.
 */
export async function renameAll(items: Renamed[]): Promise<Renamed[]> {
  const sources = new Set(items.map((item) => item.from.toLowerCase()));
  const crossing = items.some((item) => item.to.toLowerCase() !== item.from.toLowerCase() && sources.has(item.to.toLowerCase()));

  const done: Renamed[] = [];
  const name = storage.lastSegment;
  const tag = Date.now().toString(36);
  const current = items.map((item) => item.from);

  if (crossing) {
    for (let i = 0; i < items.length; i++) {
      const temp = await renamePath(current[i], `~mi-rename-${tag}-${i}`);
      await storage.remapPath(current[i], temp);
      current[i] = temp;
    }
  }
  try {
    for (let i = 0; i < items.length; i++) {
      const to = await renamePath(current[i], name(items[i].to));
      await storage.remapPath(current[i], to);
      current[i] = to;
      done.push({ from: items[i].from, to });
    }
  } catch (err) {
    // Lo que se quedó con el nombre temporal vuelve a su nombre original.
    if (crossing) {
      for (let i = done.length; i < items.length; i++) {
        const back = await renamePath(current[i], name(items[i].from)).catch(() => null);
        if (back !== null) await storage.remapPath(current[i], back);
      }
    }
    // Lo ya renombrado viaja en el error para poder deshacerlo igualmente.
    if (done.length > 0 && typeof err === "object" && err !== null) Object.assign(err, { partial: done });
    throw err;
  }
  return done;
}

/** Destino completo de una vista previa. */
export function targetOf(preview: Preview): Renamed {
  const dir = parentPath(preview.entry.path) ?? "";
  return { from: preview.entry.path, to: `${dir.replace(/\\$/, "")}\\${preview.next}` };
}
