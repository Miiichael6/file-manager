import { useEffect, useRef } from "react";

import { useT } from "../../../shared/i18n/index";
import { jumpList } from "./ports";
import type { Launch } from "../domain/ports";

export type { Launch };

/*
 * MI-FORK: lista de saltos de la barra de tareas (src-tauri/src/mi_fork.rs).
 *
 * La categoría «Acceso rápido» del icono muestra solo las carpetas ancladas en
 * Acceso rápido (`favorites` de settings.json), en el mismo orden. Una carpeta
 * elegida ahí — o pasada desde la terminal (`file-manager.exe <ruta>`, ver
 * src-tauri/src/mi_cli.rs) — llega al arrancar (`startup_launch`) o, con la app
 * ya abierta, como evento `mi-open-folder`; en ambos casos se abre en una
 * pestaña nueva, con el archivo indicado seleccionado.
 */

/** Cambios seguidos (arrastrar para reordenar) no reescriben la lista en cada paso. */
const WRITE_DELAY = 500;

/**
 * `currentDir` = carpeta real del panel activo (null en Papelera, búsqueda,
 * etiquetas). `folders` = rutas de las carpetas de Acceso rápido. `openTab` =
 * abrir una pestaña nueva de App.tsx (y seleccionar en ella).
 */
export function useJumpList(currentDir: string | null, folders: string[], openTab: (launch: Launch) => void) {
  const t = useT();
  const category = t("jumpList.recent");
  const openTabRef = useRef(openTab);
  openTabRef.current = openTab;
  const started = useRef(false);
  // El array cambia de identidad en cada render; la clave solo cuando cambia el contenido.
  const key = folders.join("\n");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const paths = key === "" ? [] : key.split("\n");
      void jumpList.get().set(category, paths).catch(() => undefined);
    }, WRITE_DELAY);
    return () => window.clearTimeout(timer);
  }, [category, key]);

  // Carpeta de la lista con la app ya abierta (tauri-plugin-single-instance).
  useEffect(() => {
    const unlisten = jumpList.get().onOpenFolder((launch) => openTabRef.current(launch));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Carpeta pasada al arrancar: después de restaurar las pestañas guardadas
  // (la primera carpeta real), si no la restauración la pisaría.
  useEffect(() => {
    if (currentDir === null || started.current) return;
    started.current = true;
    void jumpList
      .get()
      .startupLaunch()
      .then((launch) => {
        if (launch) openTabRef.current(launch);
      })
      .catch(() => undefined);
  }, [currentDir]);
}
