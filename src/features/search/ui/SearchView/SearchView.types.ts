import type { CriterionRow } from "../../domain/searchCriteria.types";
import type { FileEntry } from "../../../../shared/domain/types";

export type SearchViewProps = {
  /** Složka, od které se prohledává dolů. */
  root: string;
  query: string;
  /** Kritéria rozšířeného hledání; bez nich se hledá jen podle `query`. */
  criteria?: CriterionRow[];
  windowFocused: boolean;
  selectedPath: string | null;
  onSelectionChange: (entry: FileEntry | null) => void;
  onOpen: (entry: FileEntry) => void;
  /** Pravý klik — stejné menu jako u běžné položky. */
  onContextMenu: (entry: FileEntry, x: number, y: number) => void;
  /** Roste po každé souborové operaci; výsledky se pak načtou znovu. */
  refreshToken: number;
  showHidden: boolean;
  /** Ať status bar hlásí počet výsledků, ne obsah podkladové složky. */
  onCountChange: (count: number) => void;
};
