import type { MessageKey } from "../../../../shared/i18n/index.types";

export type Props = {
  /** Carpeta actual; null = no hay carpeta real (etiquetas, búsqueda, Papelera). */
  path: string | null;
  /** runOperation de App.tsx (aviso de error traducido). */
  run: (label: MessageKey, action: () => Promise<unknown>) => void;
};
