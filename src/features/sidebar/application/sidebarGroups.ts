import { useSyncExternalStore } from "react";
import { getStore } from "@tauri-apps/plugin-store";

import * as storage from "../../../shared/infrastructure/storage";
import type { CustomFavorite } from "../../../shared/domain/types";

/*
 * MI-FORK: secciones propias en el sidebar (grupos de favoritos).
 *
 * Los favoritos siguen siendo una sola lista en `favorites` (settings.json);
 * cada uno lleva opcionalmente `group` con el id de su sección. Sin `group`
 * (o con un id que ya no existe) va a «Acceso rápido». El orden dentro de
 * una sección es el orden de la lista global, filtrada.
 *
 * La lista de secciones (nombre y orden) va en la clave propia
 * `miSidebarGroups`, sin tocar lib/storage.ts.
 */

export type SidebarGroup = { id: string; name: string };

const KEY = "miSidebarGroups";
const STORE_FILE = "settings.json";

let current: SidebarGroup[] = [];
const listeners = new Set<() => void>();

function sanitize(value: unknown): SidebarGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item): SidebarGroup[] => {
    if (typeof item !== "object" || item === null) return [];
    const { id, name } = item as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: typeof name === "string" && name.trim() !== "" ? name : "…" }];
  });
}

function apply(value: SidebarGroup[]) {
  current = value;
  for (const listener of listeners) listener();
}

// storage.init() ya cargó settings.json; getStore devuelve esa misma instancia.
const loaded = storage.init().then(() => getStore(STORE_FILE));

void loaded
  .then((store) => store?.get<unknown>(KEY))
  .then((value) => apply(sanitize(value)))
  .catch(() => undefined);

async function save(value: SidebarGroup[]): Promise<void> {
  apply(value);
  const store = await loaded.catch(() => null);
  await store?.set(KEY, value).catch(() => undefined);
}

export function useSidebarGroups(): SidebarGroup[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

/** Sección real del favorito: un id desconocido cuenta como «Acceso rápido». */
export function groupOf(item: CustomFavorite, groups: SidebarGroup[]): string | undefined {
  return item.group !== undefined && groups.some((group) => group.id === item.group) ? item.group : undefined;
}

/** Crea la sección al final y devuelve su id (para renombrarla en el acto). */
export async function addGroup(name: string): Promise<string> {
  const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await save([...current, { id, name }]);
  return id;
}

export async function renameGroup(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed === "") return;
  await save(current.map((group) => (group.id === id ? { ...group, name: trimmed } : group)));
}

/** Sube (-1) o baja (+1) la sección entre las demás. */
export async function shiftGroup(id: string, delta: -1 | 1): Promise<void> {
  const from = current.findIndex((group) => group.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= current.length) return;
  const next = [...current];
  [next[from], next[to]] = [next[to], next[from]];
  await save(next);
}

/** Borra la sección; sus favoritos vuelven a «Acceso rápido», no se pierden. */
export async function removeGroup(id: string): Promise<void> {
  const favorites = storage.getSnapshot().favorites;
  if (favorites.some((item) => item.group === id)) {
    await storage.setFavorites(
      favorites.map((item) => {
        if (item.group !== id) return item;
        const { group: _drop, ...rest } = item;
        return rest;
      }),
    );
  }
  await save(current.filter((group) => group.id !== id));
}

/**
 * Coloca el favorito en `group` en la posición `index` de esa sección (la que
 * marcaba el indicador, contada *antes* de sacar el elemento arrastrado).
 * Sirve tanto para reordenar como para mover entre secciones o añadir uno nuevo.
 */
async function place(item: CustomFavorite, group: string | undefined, index: number): Promise<void> {
  const all = storage.getSnapshot().favorites;
  const inGroup = (fav: CustomFavorite) => groupOf(fav, current) === group;
  const members = all.filter(inGroup);

  const from = members.findIndex((fav) => storage.samePath(fav.path, item.path));
  const target = from >= 0 && index > from ? index - 1 : index;
  const others = members.filter((fav) => !storage.samePath(fav.path, item.path));
  const rest = all.filter((fav) => !storage.samePath(fav.path, item.path));

  const { group: _old, ...base } = item;
  const placed: CustomFavorite = group === undefined ? base : { ...base, group };

  const anchor = others[Math.max(0, Math.min(target, others.length))];
  let at: number;
  if (anchor !== undefined) at = rest.indexOf(anchor);
  else if (others.length > 0) at = rest.indexOf(others[others.length - 1]) + 1;
  else at = rest.length;

  rest.splice(at, 0, placed);
  await storage.setFavorites(rest);
}

/** Reordena o mueve a otra sección un favorito que ya existe. */
export async function moveFavoriteTo(path: string, group: string | undefined, index: number): Promise<void> {
  const item = storage.getSnapshot().favorites.find((fav) => storage.samePath(fav.path, path));
  if (item) await place(item, group, index);
}

/** Como storage.addFavorite, pero dentro de una sección. Duplicados no. */
export async function addFavoriteTo(item: CustomFavorite, group: string | undefined, index: number): Promise<boolean> {
  if (storage.getSnapshot().favorites.some((fav) => storage.samePath(fav.path, item.path))) return false;
  await place(item, group, index);
  return true;
}
