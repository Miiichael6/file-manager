import type { NavState } from "../../navigation/application/navigation.types";
import type { TagColor, ViewMode } from "../../../shared/domain/types";
import type { SortDirection, SortKey } from "../../../shared/domain/format.types";
import type { PanelSearch } from "../../search/domain/searchCriteria.types";
import type { ColumnSnapshot } from "../../column-view/application/columns.types";

/** Uložený stav neaktivní záložky. */
export type TabSnapshot = {
  nav: NavState;
  viewMode: ViewMode;
  sortKey: SortKey;
  sortDirection: SortDirection;
  query: string;
  search: PanelSearch | null;
  tagFilter: TagColor | null;
  trashView: boolean;
  /** MI-FORK: pohled «Este equipo». */
  computerView: boolean;
  selection: string[];
  active: string | null;
  scrollTop: number;
  /** Column view: hierarchie sloupců s výběry a zaměřený sloupec. */
  columns: ColumnSnapshot[];
  columnFocus: number;
};

export type Tab = {
  id: number;
  /** Levý panel. Pro aktivní záložku zastaralý — platí živý stav panelů. */
  snapshot: TabSnapshot;
  /** Pravý panel (rozdělené okno); chybí, dokud záložka rozdělená nebyla. */
  second?: TabSnapshot;
  /** Záložka je rozdělená na dva panely. */
  split?: boolean;
  /** Který panel byl aktivní (0 = levý). */
  activePanel?: 0 | 1;
  /** Záložka se právě zavírá (animace) — už není cílem zkratek ani kliků. */
  closing?: boolean;
  /** Právě otevřená — ouško vjede animací (jen chvíli po otevření). */
  fresh?: boolean;
};
