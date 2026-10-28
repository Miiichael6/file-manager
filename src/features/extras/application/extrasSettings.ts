import { useSyncExternalStore } from "react";
import { getStore } from "@tauri-apps/plugin-store";

import * as storage from "../../../shared/infrastructure/storage";

/*
 * MI-FORK: ajustes de los extras de la vista Lista, en settings.json con
 * claves propias (sin tocar lib/storage.ts):
 * - `miGroupBy`: agrupar por tipo / fecha / tamaño ("none" = sin grupos),
 * - `miFolderSizes`: calcular el tamaño de las carpetas en segundo plano.
 */

export type GroupBy = "none" | "kind" | "date" | "size";
export const GROUP_BY: GroupBy[] = ["none", "kind", "date", "size"];

type Settings = { groupBy: GroupBy; folderSizes: boolean };

const STORE_FILE = "settings.json";
const KEYS = { groupBy: "miGroupBy", folderSizes: "miFolderSizes" } as const;

let settings: Settings = { groupBy: "none", folderSizes: false };
const listeners = new Set<() => void>();
const loaded = storage.init().then(() => getStore(STORE_FILE));

function publish(next: Settings) {
  settings = next;
  for (const listener of listeners) listener();
}

void loaded
  .then(async (store) => {
    const groupBy = await store?.get<unknown>(KEYS.groupBy);
    const folderSizes = await store?.get<unknown>(KEYS.folderSizes);
    publish({
      groupBy: GROUP_BY.includes(groupBy as GroupBy) ? (groupBy as GroupBy) : "none",
      folderSizes: folderSizes === true,
    });
  })
  .catch(() => undefined);

export function useExtrasSettings(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => settings,
  );
}

export function setExtrasSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  publish({ ...settings, [key]: value });
  void loaded.then((store) => store?.set(KEYS[key], value)).catch(() => undefined);
}
