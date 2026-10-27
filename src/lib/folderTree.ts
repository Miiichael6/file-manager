import { useSyncExternalStore } from "react";
import { getStore } from "@tauri-apps/plugin-store";

import { invoke, parentPath } from "../fileops";
import { compareNames } from "../format";
import type { FileEntry } from "../types";
import * as storage from "./storage";

/*
 * MI-FORK: árbol de carpetas del sidebar (components/FolderTree.tsx).
 *
 * Los hijos se cargan solo al expandir (`list_dir`) y se guardan en caché por
 * ruta. Qué nodos están expandidos va por pestaña y se guarda en settings.json
 * (clave propia `miTree`), igual que folderColor.ts, sin tocar lib/storage.ts.
 */

export type TreeChildren = { status: "loading" } | { status: "ready"; entries: FileEntry[] } | { status: "error" };

/** Fila del árbol aplanado (sin la raíz, que la pinta el sidebar). */
export type TreeRow = { entry: FileEntry; depth: number };

/** `*` expande como mucho tantas carpetas — node_modules no debe colgar la app. */
const EXPAND_ALL_LIMIT = 400;

const KEY = "miTree";
const STORE_FILE = "settings.json";

const key = storage.pathKey;

/* --------------------------------- estado --------------------------------- */

const children = new Map<string, TreeChildren>();
/** Nodos expandidos por pestaña; las claves son pathKey(). */
const expandedByTab = new Map<number, Map<string, string>>();
let tabId = 0;
let showFiles = false;
let showHidden = false;
let version = 0;
const listeners = new Set<() => void>();

/*
 * Animación: solo tras una acción del usuario (expandir, contraer, seguir a la
 * carpeta). Al arrancar o con cambios en disco el árbol cambia sin moverse.
 * `revealedAt` = cuándo se vieron los hijos de un nodo recién abierto
 * ("pending" mientras list_dir no responde).
 */
const MOTION_WINDOW_MS = 600;
const ENTER_WINDOW_MS = 500;
const revealedAt = new Map<string, number | "pending">();
let lastAction = -Infinity;

function markAction() {
  lastAction = performance.now();
}

function markRevealed(path: string) {
  const k = key(path);
  revealedAt.set(k, children.get(k)?.status === "ready" ? performance.now() : "pending");
  markAction();
}

/** ¿Debe el árbol animar este cambio? (Lo pregunta el render.) */
export function treeInMotion(): boolean {
  return performance.now() - lastAction < MOTION_WINDOW_MS;
}

/** ¿Los hijos de `path` acaban de aparecer por una acción del usuario? */
export function revealedRecently(path: string): boolean {
  const at = revealedAt.get(key(path));
  return typeof at === "number" && performance.now() - at < ENTER_WINDOW_MS;
}

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function expanded(): Map<string, string> {
  let map = expandedByTab.get(tabId);
  if (map === undefined) {
    map = new Map();
    expandedByTab.set(tabId, map);
  }
  return map;
}

export function useFolderTree(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
}

/* -------------------------------- carga ----------------------------------- */

function sortTree(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return compareNames(a.name, b.name);
  });
}

const pending = new Map<string, Promise<void>>();

/** Lee los hijos de una carpeta. Sin `force` reutiliza la caché. */
export function loadChildren(path: string, force = false): Promise<void> {
  const k = key(path);
  const running = pending.get(k);
  if (running) return running;
  if (!force && children.get(k)?.status === "ready") return Promise.resolve();

  // Al recargar se queda lo anterior en pantalla hasta que llega lo nuevo.
  if (!children.has(k)) {
    children.set(k, { status: "loading" });
    emit();
  }
  const request = invoke<FileEntry[]>("list_dir", { path, showHidden })
    .then(
      (entries) => {
        children.set(k, { status: "ready", entries: sortTree(entries) });
        if (revealedAt.get(k) === "pending") markRevealed(path);
      },
      () => {
        children.set(k, { status: "error" });
        revealedAt.delete(k);
      },
    )
    .finally(() => {
      pending.delete(k);
      emit();
    });
  pending.set(k, request);
  return request;
}

export function childrenOf(path: string): TreeChildren | undefined {
  return children.get(key(path));
}

/**
 * ¿Tiene sentido la flecha? Sin cargar no se sabe (se muestra); cargado, solo
 * si hay algo que enseñar.
 */
export function canExpand(path: string): boolean {
  const node = children.get(key(path));
  if (node === undefined || node.status === "loading") return true;
  if (node.status === "error") return false;
  return node.entries.some((entry) => entry.is_dir || showFiles);
}

/** Recarga los nodos ya cargados de estas carpetas (cambio en disco). */
export function refreshLoaded(paths: string[]) {
  for (const path of paths) {
    if (children.has(key(path))) void loadChildren(path, true);
  }
}

/* ------------------------------ expandir ---------------------------------- */

export function isExpanded(path: string): boolean {
  return expanded().has(key(path));
}

export function setExpanded(path: string, open: boolean) {
  const map = expanded();
  const k = key(path);
  if (open === map.has(k)) return;
  if (open) {
    map.set(k, path);
    markRevealed(path);
    void loadChildren(path);
  } else {
    map.delete(k);
    revealedAt.delete(k);
    markAction();
  }
  emit();
  save();
}

export function toggleExpanded(path: string) {
  setExpanded(path, !isExpanded(path));
}

/**
 * Expande los antepasados de `target` (no `target` mismo) bajo `root`, solo si
 * el usuario ya tiene `root` desplegada — navegar a C:\dev desde un favorito no
 * debe abrir C:\ entero.
 */
export function revealPath(root: string, target: string) {
  if (!expanded().has(key(root))) return;
  const chain: string[] = [];
  let parent = parentPath(target);
  while (parent !== null && key(parent).length >= key(root).length) {
    chain.unshift(parent);
    if (key(parent) === key(root)) break;
    parent = parentPath(parent);
  }
  if (chain.length === 0 || key(chain[0]) !== key(root)) return;

  const map = expanded();
  let changed = false;
  for (const path of chain) {
    if (!map.has(key(path))) {
      map.set(key(path), path);
      markRevealed(path);
      changed = true;
    }
    void loadChildren(path);
  }
  if (changed) {
    emit();
    save();
  }
}

/** Contrae todo dentro de `root` (o el árbol entero sin argumento). */
export function collapseAll(root?: string) {
  const map = expanded();
  const prefix = root === undefined ? null : key(root);
  for (const k of [...map.keys()]) {
    if (prefix === null || k === prefix || k.startsWith(`${prefix}\\`)) map.delete(k);
  }
  markAction();
  emit();
  save();
}

/**
 * `*` del Explorador: expande todo el subárbol, en anchura y con límite. Los
 * enlaces simbólicos y uniones no se recorren — una unión que apunta a un
 * antepasado haría un ciclo infinito.
 */
export async function expandSubtree(root: string) {
  const queue = [root];
  let count = 0;
  const map = expanded();
  while (queue.length > 0 && count < EXPAND_ALL_LIMIT) {
    const path = queue.shift()!;
    if (!map.has(key(path))) markRevealed(path);
    map.set(key(path), path);
    count += 1;
    await loadChildren(path);
    const node = children.get(key(path));
    if (node?.status !== "ready") continue;
    for (const entry of node.entries) {
      if (entry.is_dir && !entry.is_symlink) queue.push(entry.path);
    }
    emit();
  }
  emit();
  save();
}

/* ------------------------------- aplanar ---------------------------------- */

/** Filas visibles bajo `root` en orden de pantalla. */
export function flatten(root: string): TreeRow[] {
  const rows: TreeRow[] = [];
  const map = expanded();
  const walk = (path: string, depth: number, seen: Set<string>) => {
    if (!map.has(key(path))) return;
    const node = children.get(key(path));
    if (node?.status !== "ready") return;
    for (const entry of node.entries) {
      if (!entry.is_dir && !showFiles) continue;
      rows.push({ entry, depth });
      // Protección contra ciclos: la misma carpeta no se abre dentro de sí misma.
      const k = key(entry.path);
      if (entry.is_dir && !seen.has(k)) walk(entry.path, depth + 1, new Set(seen).add(k));
    }
  };
  walk(root, 1, new Set([key(root)]));
  return rows;
}

/* ------------------------------ opciones ---------------------------------- */

export function treeShowsFiles(): boolean {
  return showFiles;
}

export function setTreeShowFiles(value: boolean) {
  if (value === showFiles) return;
  showFiles = value;
  emit();
  save();
}

/** Archivos ocultos: la caché vale solo para un valor, al cambiarlo se recarga. */
export function setTreeShowHidden(value: boolean) {
  if (value === showHidden) return;
  showHidden = value;
  const loaded = [...children.keys()];
  children.clear();
  for (const k of loaded) {
    const path = expanded().get(k);
    if (path !== undefined) void loadChildren(path);
  }
  emit();
}

/** Pestaña activa — cada una recuerda sus nodos expandidos. */
export function setTreeTab(id: number) {
  if (id === tabId) return;
  tabId = id;
  for (const path of expanded().values()) void loadChildren(path);
  emit();
}

export function forgetTreeTab(id: number) {
  if (expandedByTab.delete(id)) save();
}

/* ------------------------------ persistencia ------------------------------ */

type Saved = { showFiles: boolean; tabs: string[][] };

/** Orden de las pestañas tal como las guarda App (índice = pestaña restaurada). */
let tabOrder: number[] = [];
let restored: string[][] = [];
let ready = false;

const loaded = storage.init().then(() => getStore(STORE_FILE));

void loaded
  .then((store) => store?.get<unknown>(KEY))
  .then((value) => {
    const saved = value as Partial<Saved> | undefined;
    if (typeof saved?.showFiles === "boolean") showFiles = saved.showFiles;
    if (Array.isArray(saved?.tabs)) {
      restored = saved.tabs.map((paths) =>
        Array.isArray(paths) ? paths.filter((path): path is string => typeof path === "string") : [],
      );
    }
  })
  .catch(() => undefined)
  .finally(() => {
    ready = true;
    applyRestored();
    emit();
  });

/** Pestañas restauradas al arrancar: la de índice i recupera sus nodos. */
function applyRestored() {
  if (!ready || tabOrder.length === 0 || restored.length === 0) return;
  tabOrder.forEach((id, index) => {
    const paths = restored[index];
    if (paths === undefined || expandedByTab.get(id)?.size) return;
    expandedByTab.set(id, new Map(paths.map((path) => [key(path), path])));
  });
  restored = [];
  for (const path of expanded().values()) void loadChildren(path);
}

/** App avisa del orden actual de pestañas (y así sabe qué guardar). */
export function setTreeTabOrder(ids: number[]) {
  const changed = ids.length !== tabOrder.length || ids.some((id, index) => id !== tabOrder[index]);
  tabOrder = ids;
  applyRestored();
  if (changed) save();
}

let timer = 0;

function save() {
  if (!ready) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const value: Saved = {
      showFiles,
      tabs: tabOrder.map((id) => [...(expandedByTab.get(id)?.values() ?? [])]),
    };
    void loaded.then((store) => store?.set(KEY, value)).catch(() => undefined);
  }, 400);
}
