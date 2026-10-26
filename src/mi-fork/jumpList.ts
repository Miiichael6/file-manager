import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getStore } from "@tauri-apps/plugin-store";

import { invoke } from "../fileops";
import { useT } from "../i18n";
import * as storage from "../lib/storage";

/*
 * MI-FORK: lista de saltos de la barra de tareas (src-tauri/src/mi_fork.rs).
 *
 * Las últimas carpetas abiertas se guardan en settings.json (`miRecentFolders`)
 * y se escriben en la categoría «Recientes» del icono. Una carpeta elegida ahí
 * llega como argumento al arrancar (`startup_folder`) o, con la app ya abierta,
 * como evento `mi-open-folder`; en ambos casos se abre en una pestaña nueva.
 */

const KEY = "miRecentFolders";
const STORE_FILE = "settings.json";
const LIMIT = 10;
/** Navegar rápido no reescribe la lista en cada paso. */
const WRITE_DELAY = 1500;

function samePath(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * `currentDir` = carpeta real del panel activo (null en Papelera, búsqueda,
 * etiquetas). `openTab` = abrir una pestaña nueva de App.tsx.
 */
export function useJumpList(currentDir: string | null, openTab: (path: string) => void) {
  const t = useT();
  const category = t("jumpList.recent");
  const recent = useRef<string[] | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const openTabRef = useRef(openTab);
  openTabRef.current = openTab;
  const started = useRef(false);

  function write() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const paths = recent.current ?? [];
      void invoke("set_jump_list", { category: categoryRef.current, paths }).catch(() => undefined);
      void storage
        .init()
        .then(() => getStore(STORE_FILE))
        .then((store) => store?.set(KEY, paths))
        .catch(() => undefined);
    }, WRITE_DELAY);
  }

  // Lista guardada (y reescritura con el idioma actual).
  useEffect(() => {
    void storage
      .init()
      .then(() => getStore(STORE_FILE))
      .then((store) => store?.get<unknown>(KEY))
      .then((value) => {
        const saved = Array.isArray(value) ? value.filter((path): path is string => typeof path === "string") : [];
        // Lo visitado mientras cargaba va delante.
        const visited = recent.current ?? [];
        recent.current = [...visited, ...saved.filter((path) => !visited.some((known) => samePath(known, path)))].slice(0, LIMIT);
        write();
      })
      .catch(() => undefined);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    if (currentDir === null) return;
    const list = recent.current ?? [];
    if (list.length > 0 && samePath(list[0], currentDir)) return;
    recent.current = [currentDir, ...list.filter((path) => !samePath(path, currentDir))].slice(0, LIMIT);
    write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDir]);

  // Carpeta de la lista con la app ya abierta (tauri-plugin-single-instance).
  useEffect(() => {
    const unlisten = listen<string>("mi-open-folder", (event) => openTabRef.current(event.payload));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Carpeta pasada al arrancar: después de restaurar las pestañas guardadas
  // (la primera carpeta real), si no la restauración la pisaría.
  useEffect(() => {
    if (currentDir === null || started.current) return;
    started.current = true;
    void invoke<string | null>("startup_folder")
      .then((path) => {
        if (path) openTabRef.current(path);
      })
      .catch(() => undefined);
  }, [currentDir]);
}
