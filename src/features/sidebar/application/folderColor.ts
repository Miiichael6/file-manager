import { useSyncExternalStore } from "react";
import { getStore } from "@tauri-apps/plugin-store";

import * as storage from "../../../shared/infrastructure/storage";

/*
 * MI-FORK: color de las carpetas (Más → Apariencia → Color de carpetas).
 *
 * Cambia las variables --folder-* que usa FolderIcon (components/icons.tsx).
 * Van como estilo en línea de <html>, así ganan tanto a :root como a .dark;
 * el ámbar original no escribe nada y deja los valores de index.css.
 *
 * El valor se guarda en settings.json (clave propia `miFolderColor`) sin tocar
 * lib/storage.ts; en localStorage hay una copia solo para el primer render,
 * igual que el tema.
 */

export type FolderColor =
  | "amber"
  | "yellow"
  | "orange"
  | "red"
  | "pink"
  | "purple"
  | "indigo"
  | "blue"
  | "windowsBlue"
  | "sky"
  | "teal"
  | "green"
  | "lime"
  | "brown"
  | "gray"
  | "graphite";

type Palette = { back: string; frontTop: string; front: string; glyph: string };

export const FOLDER_PALETTES: Record<FolderColor, Palette> = {
  amber: { back: "#e0a12a", frontTop: "#ffd86b", front: "#f6b73c", glyph: "rgba(122, 72, 0, 0.75)" },
  yellow: { back: "#e6b800", frontTop: "#fff07a", front: "#ffd60a", glyph: "rgba(120, 90, 0, 0.75)" },
  orange: { back: "#e0701f", frontTop: "#ffb36b", front: "#fb8c3c", glyph: "rgba(120, 50, 0, 0.75)" },
  red: { back: "#c9353a", frontTop: "#ff8a8a", front: "#ef4c50", glyph: "rgba(110, 10, 15, 0.75)" },
  pink: { back: "#d6407f", frontTop: "#ff9ec6", front: "#f2679f", glyph: "rgba(115, 15, 60, 0.75)" },
  purple: { back: "#7a45c9", frontTop: "#c9a3ff", front: "#9b6af0", glyph: "rgba(55, 20, 110, 0.75)" },
  indigo: { back: "#4b4fc4", frontTop: "#a3a8ff", front: "#6a6ff0", glyph: "rgba(25, 28, 110, 0.75)" },
  blue: { back: "#2f78d6", frontTop: "#8cc4ff", front: "#4a9af5", glyph: "rgba(10, 50, 115, 0.75)" },
  windowsBlue: { back: "#3a8ee0", frontTop: "#a8d8ff", front: "#5cb0fa", glyph: "rgba(10, 60, 120, 0.75)" },
  sky: { back: "#1a9fc4", frontTop: "#8be6ff", front: "#38c3ea", glyph: "rgba(0, 70, 95, 0.75)" },
  teal: { back: "#139c8f", frontTop: "#7fe8d9", front: "#2ec4b3", glyph: "rgba(0, 70, 62, 0.75)" },
  green: { back: "#2f9a4a", frontTop: "#8fe6a2", front: "#45c062", glyph: "rgba(10, 70, 25, 0.75)" },
  lime: { back: "#7aa81f", frontTop: "#d6f57a", front: "#9fd13a", glyph: "rgba(55, 80, 0, 0.75)" },
  brown: { back: "#8a5a32", frontTop: "#d6a77a", front: "#a8744a", glyph: "rgba(65, 35, 10, 0.75)" },
  gray: { back: "#7c8590", frontTop: "#d3d8de", front: "#a3abb5", glyph: "rgba(40, 45, 52, 0.75)" },
  graphite: { back: "#3c4149", frontTop: "#8a919c", front: "#565d68", glyph: "rgba(235, 238, 242, 0.7)" },
};

export const FOLDER_COLORS = Object.keys(FOLDER_PALETTES) as FolderColor[];

const KEY = "miFolderColor";
const MIRROR = "mi-folder-color";
const STORE_FILE = "settings.json";

const isFolderColor = (value: unknown): value is FolderColor =>
  typeof value === "string" && value in FOLDER_PALETTES;

let current = readMirror();
const listeners = new Set<() => void>();

function readMirror(): FolderColor {
  try {
    const value = localStorage.getItem(MIRROR);
    return isFolderColor(value) ? value : "amber";
  } catch {
    return "amber";
  }
}

/** Variables CSS de una paleta — también sirve para las muestras del menú. */
export function folderColorVars(color: FolderColor): Record<string, string> {
  const p = FOLDER_PALETTES[color];
  return {
    "--folder-back": p.back,
    "--folder-front-top": p.frontTop,
    "--folder-front": p.front,
    "--folder-glyph": p.glyph,
  };
}

function apply(value: FolderColor) {
  current = value;
  const style = document.documentElement.style;
  for (const [name, color] of Object.entries(folderColorVars(value))) {
    if (value === "amber") style.removeProperty(name);
    else style.setProperty(name, color);
  }
  try {
    localStorage.setItem(MIRROR, value);
  } catch {
    // Sin localStorage solo se pierde la copia del primer render.
  }
  for (const listener of listeners) listener();
}

// storage.init() ya cargó settings.json; getStore devuelve esa misma instancia.
const loaded = storage.init().then(() => getStore(STORE_FILE));

apply(current);
void loaded
  .then((store) => store?.get<unknown>(KEY))
  .then((value) => {
    if (isFolderColor(value) && value !== current) apply(value);
  })
  .catch(() => undefined);

export function useFolderColor(): FolderColor {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export async function setFolderColor(value: FolderColor): Promise<void> {
  apply(value);
  const store = await loaded.catch(() => null);
  await store?.set(KEY, value).catch(() => undefined);
}
