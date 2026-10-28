import { useSyncExternalStore } from "react";

import { settingsStore } from "../../../shared/application/ports";

/*
 * MI-FORK: ajustes de los extras de la vista Lista, en settings.json con
 * claves propias (sin tocar lib/storage.ts):
 * - `miGroupBy`: agrupar por tipo / fecha / tamaño ("none" = sin grupos),
 * - `miFolderSizes`: calcular el tamaño de las carpetas en segundo plano.
 */

export type GroupBy = "none" | "kind" | "date" | "size";
export const GROUP_BY: GroupBy[] = ["none", "kind", "date", "size"];

type Settings = { groupBy: GroupBy; folderSizes: boolean };

const KEYS = { groupBy: "miGroupBy", folderSizes: "miFolderSizes" } as const;

let settings: Settings = { groupBy: "none", folderSizes: false };
const listeners = new Set<() => void>();

function publish(next: Settings) {
  settings = next;
  for (const listener of listeners) listener();
}

void Promise.all([settingsStore.get().read(KEYS.groupBy), settingsStore.get().read(KEYS.folderSizes)]).then(
  ([groupBy, folderSizes]) =>
    publish({
      groupBy: GROUP_BY.includes(groupBy as GroupBy) ? (groupBy as GroupBy) : "none",
      folderSizes: folderSizes === true,
    }),
);

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
  void settingsStore.get().write(KEYS[key], value);
}
