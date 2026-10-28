/** Carpeta que abrir y, si se pidió un archivo o `--select`, el elemento que seleccionar. */
export type Launch = { path: string; select: string | null };

/** Lista de saltos de la barra de tareas (mi_fork.rs) y carpetas pedidas desde fuera. */
export interface JumpList {
  /** Reescribe la categoría con estas carpetas, en este orden. */
  set(category: string, paths: string[]): Promise<void>;
  /** Carpeta pedida con la app ya abierta (single-instance); devuelve cómo dejar de escuchar. */
  onOpenFolder(handler: (launch: Launch) => void): Promise<() => void>;
  /** Carpeta pasada al arrancar (null = ninguna); se entrega una sola vez. */
  startupLaunch(): Promise<Launch | null>;
}
