import type { FavoriteSection } from "../../../../shared/domain/types";

export type Level = "ok" | "warn" | "full";

export type ComputerViewProps = {
  sections: FavoriteSection[];
  /** Ahora mismo no cambia el aspecto; se deja por coherencia con las otras vistas. */
  windowFocused: boolean;
  onOpen: (path: string) => void;
  onOpenTab: (path: string) => void;
  /** Para que la barra de estado cuente unidades y no la carpeta de debajo. */
  onCountChange: (count: number) => void;
};
