import type { FileEntry } from "../../../shared/domain/types";

export type TreeChildren = { status: "loading" } | { status: "ready"; entries: FileEntry[] } | { status: "error" };

/** Fila del árbol aplanado (sin la raíz, que la pinta el sidebar). */
export type TreeRow = { entry: FileEntry; depth: number };

export type Saved = { showFiles: boolean; tabs: string[][] };
