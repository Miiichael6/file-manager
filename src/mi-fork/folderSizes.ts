import { useEffect, useSyncExternalStore } from "react";
import { Channel } from "@tauri-apps/api/core";

import { invoke } from "../fileops";
import type { FileEntry } from "../types";

/*
 * MI-FORK: tamaño de las carpetas en la columna Tamaño de la vista Lista
 * (src-tauri/src/mi_extras.rs: folder_sizes). Se calcula en segundo plano,
 * una carpeta tras otra, y se guarda en memoria por ruta. Si la carpeta
 * cambia de fecha (entró o salió algo directamente en ella), se recalcula.
 */

type Size = { bytes: number; done: boolean; modified: number };
type Message = { path: string; bytes: number; done: boolean };

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
    const channel = new Channel<Message>();
    channel.onmessage = ({ path, bytes, done }) => {
      sizes.set(keyOf(path), { bytes, done, modified: modified.get(keyOf(path)) ?? 0 });
      notify(path);
    };
    void invoke("folder_sizes", { paths: pending.map((entry) => entry.path), requestId, onSize: channel }).catch(
      () => undefined,
    );
    return () => void invoke("cancel_folder_sizes", { requestId }).catch(() => undefined);
  }, [entries, enabled]);
}
