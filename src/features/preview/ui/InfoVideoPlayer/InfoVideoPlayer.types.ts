import type { ReactNode } from "react";

export type Props = {
  path: string;
  /** Proporción del video ("1920 / 1080"): la caja la tiene desde el primer
   *  fotograma, sin esperar a los metadatos (si no, <video> mide 150 px de alto
   *  y la caja crece un momento). */
  ratio: string;
  /** Miniatura encima hasta que hay imagen — sin destello negro. */
  cover: ReactNode;
  /** Audio: la carátula se queda arriba y los controles fijos debajo
   *  (sin pantalla completa ni imagen en imagen). */
  audio?: boolean;
};
