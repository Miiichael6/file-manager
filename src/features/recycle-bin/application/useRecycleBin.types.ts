import type { MessageKey } from "../../../shared/i18n/index.types";
import type { ItemFailure } from "../../../shared/application/fileops";
import type { ConfirmRequest } from "../../dialogs/ui/ConfirmDialog";

export type Options = {
  /** Mění se po každé operaci v panelech — spouští nové načtení stavu Koše. */
  refreshTokens: readonly [number, number];
  runOperation: (label: MessageKey, action: () => Promise<unknown>) => Promise<void>;
  reportFailures: (label: MessageKey, failed: ItemFailure[], count: number) => void;
  askAdmin: (paths: string[], retry: () => void) => void;
  setConfirm: (request: ConfirmRequest) => void;
  /** Zobrazený název položky (skrytá přípona apod.). */
  displayName: (name: string) => string;
};
