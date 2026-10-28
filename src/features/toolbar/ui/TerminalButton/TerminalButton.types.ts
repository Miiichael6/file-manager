import type { MessageKey } from "../../../../shared/i18n/index.types";

export type Props = {
  /** Carpeta actual; null = no hay carpeta real. */
  path: string | null;
  /** runOperation de App.tsx (aviso de error traducido). */
  run: (label: MessageKey, action: () => Promise<unknown>) => void;
};
