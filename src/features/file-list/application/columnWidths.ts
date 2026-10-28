import { useSyncExternalStore } from "react";
import { getStore } from "@tauri-apps/plugin-store";

import * as storage from "../../../shared/infrastructure/storage";

/*
 * MI-FORK: anchos de las columnas de la vista Lista (Nombre, Fecha, Tamaño,
 * Tipo). Nombre empieza flexible (null = se queda con el resto); al arrastrar
 * cualquier tirador se fija en px y desde ahí todas las columnas tienen ancho
 * propio, como en el Explorador. Cada panel de la ventana dividida tiene los
 * suyos (pane 0 = izquierdo, 1 = derecho): arrastrar en uno no mueve el otro.
 * Se guardan en settings.json con claves propias `miListColumns` (panel 0,
 * la de siempre) y `miListColumns2`; el panel 1 sin anchos guardados arranca
 * con los del 0. Sin tocar lib/storage.ts.
 */

export type ResizableColumn = "name" | "modified" | "size" | "kind";
export type ColumnWidths = { name: number | null } & Record<Exclude<ResizableColumn, "name">, number>;
export type Pane = 0 | 1;

export const DEFAULT_WIDTHS: ColumnWidths = { name: null, modified: 140, size: 80, kind: 100 };
const LIMITS: Record<ResizableColumn, [number, number]> = {
  name: [120, 1600],
  modified: [48, 600],
  size: [48, 600],
  kind: [48, 600],
};

const STORE_FILE = "settings.json";
const KEYS: Record<Pane, string> = { 0: "miListColumns", 1: "miListColumns2" };

const widths: [ColumnWidths, ColumnWidths] = [DEFAULT_WIDTHS, DEFAULT_WIDTHS];
const listeners = new Set<() => void>();
const loaded = storage.init().then(() => getStore(STORE_FILE));

function publish(pane: Pane, next: ColumnWidths) {
  widths[pane] = next;
  for (const listener of listeners) listener();
}

export function clampWidth(column: ResizableColumn, value: number): number {
  const [min, max] = LIMITS[column];
  return Math.round(Math.min(max, Math.max(min, value)));
}

function parse(value: unknown): ColumnWidths | null {
  if (typeof value !== "object" || value === null) return null;
  const saved = value as Partial<Record<ResizableColumn, unknown>>;
  const pick = (column: Exclude<ResizableColumn, "name">) =>
    typeof saved[column] === "number" ? clampWidth(column, saved[column] as number) : DEFAULT_WIDTHS[column];
  return {
    name: typeof saved.name === "number" ? clampWidth("name", saved.name) : null,
    modified: pick("modified"),
    size: pick("size"),
    kind: pick("kind"),
  };
}

void loaded
  .then(async (store) => {
    if (!store) return;
    const first = parse(await store.get<unknown>(KEYS[0]));
    const second = parse(await store.get<unknown>(KEYS[1])) ?? first;
    if (first) publish(0, first);
    if (second) publish(1, second);
  })
  .catch(() => undefined);

export function useColumnWidths(pane: Pane): ColumnWidths {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => widths[pane],
  );
}

export function getColumnWidths(pane: Pane): ColumnWidths {
  return widths[pane];
}

/** Cambia el ancho en pantalla (cada movimiento del tirador). null = Nombre flexible. */
export function setColumnWidth(pane: Pane, column: ResizableColumn, value: number | null) {
  const next = value === null ? (column === "name" ? null : DEFAULT_WIDTHS[column]) : clampWidth(column, value);
  if (next !== widths[pane][column]) publish(pane, { ...widths[pane], [column]: next });
}

/** Guarda los anchos actuales (al soltar el tirador, no en cada movimiento). */
export function saveColumnWidths(pane: Pane) {
  const value = widths[pane];
  void loaded.then((store) => store?.set(KEYS[pane], value)).catch(() => undefined);
}
