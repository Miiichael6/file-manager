import { useSyncExternalStore } from "react";
import { getStore } from "@tauri-apps/plugin-store";

import * as storage from "../lib/storage";
import { startLens, stopLens } from "./lens";
import "./liquid-glass.css";

/*
 * MI-FORK: opción «Liquid Glass» (Más → Apariencia y paleta).
 *
 * Solo cambia el material de las capas flotantes (barra superior, barra de
 * estado, cabecera de la lista, menús, paleta, avisos y diálogos): refracción
 * en los bordes (lens.ts), aro de luz especular, menos desenfoque y radios
 * concéntricos más amplios. El CSS vive en liquid-glass.css bajo
 * :root[data-liquid]; el contenido (lista, iconos, sidebar) no cambia.
 *
 * El valor se guarda en el mismo settings.json (clave propia `miLiquidGlass`)
 * sin tocar lib/storage.ts; en localStorage hay una copia solo para el primer
 * render, igual que el tema.
 */

const KEY = "miLiquidGlass";
const MIRROR = "mi-liquid-glass";
const STORE_FILE = "settings.json";

let enabled = readMirror();
const listeners = new Set<() => void>();

function readMirror(): boolean {
  try {
    return localStorage.getItem(MIRROR) === "1";
  } catch {
    return false;
  }
}

function apply(value: boolean) {
  enabled = value;
  if (value) {
    document.documentElement.dataset.liquid = "on";
    startLens();
  } else {
    delete document.documentElement.dataset.liquid;
    stopLens();
  }
  try {
    localStorage.setItem(MIRROR, value ? "1" : "0");
  } catch {
    // Sin localStorage solo se pierde la copia del primer render.
  }
  for (const listener of listeners) listener();
}

// storage.init() ya cargó settings.json; getStore devuelve esa misma instancia.
const loaded = storage.init().then(() => getStore(STORE_FILE));

apply(enabled);
void loaded
  .then((store) => store?.get<unknown>(KEY))
  .then((value) => {
    if (typeof value === "boolean" && value !== enabled) apply(value);
  })
  .catch(() => undefined);

export function useLiquidGlass(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

export async function setLiquidGlass(value: boolean): Promise<void> {
  apply(value);
  const store = await loaded.catch(() => null);
  await store?.set(KEY, value).catch(() => undefined);
}
