import { useEffect, useSyncExternalStore } from "react";

import { folderSizes } from "./ports";
import type { FileEntry } from "../../../shared/domain/types";
import type { Size } from "./folderSizes.types";

/*
 * MI-FORK: tamaño de las carpetas en la columna Tamaño de la vista Lista
 * (src-tauri/src/mi_extras.rs: folder_sizes). Se calcula en segundo plano,
 * una carpeta tras otra, y se guarda en memoria por ruta. Si la carpeta
 * cambia de fecha (entró o salió algo directamente en ella), se recalcula.
 */

const sizes = new Map<string, Size>();
const listeners = new Map<string, Set<() => void>>();
let nextRequest = 1;

const keyOf = (path: string) => path.toLowerCase();

function notify(path: string) {
  for (const listener of listeners.get(keyOf(path)) ?? []) listener();
}

/** Tamaño ya calculado (o parcial) de una carpeta; undefined = aún no. */
export function useFolderSize(path: string): Size | undefined {
  return useSyncExternalStore(
    (listener) => {
      const key = keyOf(path);
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => set.delete(listener);
    },
    () => sizes.get(keyOf(path)),
  );
}

/** Lanza el cálculo para las carpetas de `entries` que no lo tienen al día. */
export function useComputeFolderSizes(entries: FileEntry[], enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const pending = entries.filter((entry) => {
      if (!entry.is_dir) return false;
      const known = sizes.get(keyOf(entry.path));
      return !known?.done || known.modified !== entry.modified;
    });
    if (pending.length === 0) return;

    const modified = new Map(pending.map((entry) => [keyOf(entry.path), entry.modified]));
    const requestId = nextRequest++;
    const onSize = ({ path, bytes, done }: { path: string; bytes: number; done: boolean }) => {
      sizes.set(keyOf(path), { bytes, done, modified: modified.get(keyOf(path)) ?? 0 });
      notify(path);
    };
    void folderSizes
      .get()
      .compute(
        pending.map((entry) => entry.path),
        requestId,
        onSize,
      )
      .catch(() => undefined);
    return () => void folderSizes.get().cancel(requestId).catch(() => undefined);
  }, [entries, enabled]);
}
