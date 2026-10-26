import { createElement, useSyncExternalStore } from "react";
import { AppWindow } from "lucide-react";
import { getStore } from "@tauri-apps/plugin-store";

import type { MenuItem } from "../components/ContextMenu";
import { invoke } from "../fileops";
import type { MessageKey } from "../i18n";
import * as storage from "../lib/storage";

/*
 * MI-FORK: «Abrir con ▸» para carpetas (src-tauri/src/mi_fork.rs).
 *
 * Lista = editores encontrados en el disco (VS Code, Cursor…) + los .exe que
 * el usuario eligió con «Elegir otra aplicación…». Los elegidos se guardan en
 * settings.json con la clave propia `miFolderApps` (sin tocar lib/storage.ts).
 */

export type FolderApp = { name: string; path: string };

const KEY = "miFolderApps";
/** Ruta del último .exe usado — el botón de la barra lo ofrece primero. */
const LAST_KEY = "miFolderAppLast";
const STORE_FILE = "settings.json";

let detected: FolderApp[] = [];
let custom: FolderApp[] = [];
let apps: FolderApp[] = [];
let lastUsed: string | null = null;
/** Icono de cada .exe (data URL) por ruta en minúsculas; null = no hay. */
const icons = new Map<string, string | null>();
const listeners = new Set<() => void>();

function samePath(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function publish() {
  apps = [...detected, ...custom.filter((app) => !detected.some((known) => samePath(known.path, app.path)))];
  for (const listener of listeners) listener();
  for (const app of apps) loadIcon(app.path);
}

/** Icono del .exe desde el shell (get_file_icon, con caché en disco). */
function loadIcon(path: string) {
  const key = path.toLowerCase();
  if (icons.has(key)) return;
  icons.set(key, null);
  void invoke<string>("get_file_icon", { path, size: 32 })
    .then((url) => {
      icons.set(key, url);
      apps = [...apps];
      for (const listener of listeners) listener();
    })
    .catch(() => undefined);
}

const loaded = storage.init().then(() => getStore(STORE_FILE));

void invoke<FolderApp[]>("folder_apps")
  .then((found) => {
    detected = found;
    publish();
  })
  .catch(() => undefined);

void loaded
  .then((store) => store?.get<unknown>(KEY))
  .then((value) => {
    if (!Array.isArray(value)) return;
    custom = value.filter(
      (app): app is FolderApp => typeof app?.name === "string" && typeof app?.path === "string",
    );
    publish();
  })
  .catch(() => undefined);

void loaded
  .then((store) => store?.get<unknown>(LAST_KEY))
  .then((value) => {
    if (typeof value !== "string") return;
    lastUsed = value;
    apps = [...apps];
    for (const listener of listeners) listener();
  })
  .catch(() => undefined);

export function useFolderApps(): FolderApp[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => apps,
  );
}

export async function openFolderWith(app: FolderApp, path: string): Promise<void> {
  await invoke<void>("open_folder_with", { app: app.path, path });
  if (lastUsed !== null && samePath(lastUsed, app.path)) return;
  lastUsed = app.path;
  apps = [...apps];
  for (const listener of listeners) listener();
  const store = await loaded.catch(() => null);
  await store?.set(LAST_KEY, app.path).catch(() => undefined);
}

/** App del botón de la barra: la última usada, si no la primera encontrada. */
export function defaultFolderApp(list: FolderApp[]): FolderApp | null {
  return list.find((app) => lastUsed !== null && samePath(app.path, lastUsed)) ?? list[0] ?? null;
}

/** Icono del .exe (data URL) o undefined, mientras no está cargado. */
export function folderAppIcon(app: FolderApp): string | undefined {
  return icons.get(app.path.toLowerCase()) ?? undefined;
}

/** Diálogo para elegir un .exe; lo recuerda para la próxima vez. null = cancelado. */
async function pickFolderApp(title: string, filter: string): Promise<FolderApp | null> {
  const app = await invoke<FolderApp | null>("pick_folder_app", { title, filter });
  if (!app || apps.some((known) => samePath(known.path, app.path))) return app;
  custom = [...custom, app];
  publish();
  const store = await loaded.catch(() => null);
  await store?.set(KEY, custom).catch(() => undefined);
  return app;
}

/** Submenú «Abrir con ▸» de una carpeta. `run` = runOperation de App.tsx. */
export function folderOpenWithMenu(
  path: string,
  list: FolderApp[],
  t: (key: MessageKey) => string,
  run: (label: MessageKey, action: () => Promise<unknown>) => void,
  disabled: boolean,
): MenuItem {
  return {
    type: "submenu",
    label: t("menu.openWith").replace(/…$/, ""),
    disabled,
    items: [
      ...list.map((app) => ({
        type: "item" as const,
        label: app.name,
        icon: folderAppIcon(app)
          ? createElement("img", { src: folderAppIcon(app), width: 16, height: 16, alt: "" })
          : undefined,
        onSelect: () => run("op.openFolderWith", () => openFolderWith(app, path)),
      })),
      ...(list.length > 0 ? [{ type: "separator" as const }] : []),
      {
        type: "item",
        label: t("folderApps.choose"),
        icon: createElement(AppWindow, { size: 16 }),
        onSelect: () =>
          run("op.openFolderWith", async () => {
            const app = await pickFolderApp(t("folderApps.choose").replace(/…$/, ""), t("folderApps.filter"));
            if (app) await openFolderWith(app, path);
          }),
      },
    ],
  };
}
