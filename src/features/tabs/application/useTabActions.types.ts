import type { Tab } from "./browser.types";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Panel } from "../../navigation/application/panel.types";
import type { ViewMode } from "../../../shared/domain/types";
import type { SortKey } from "../../../shared/domain/format.types";

export type Options = {
  tabs: Tab[];
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  activeTabId: number;
  setActiveTabId: Dispatch<SetStateAction<number>>;
  /** applyTab pro efekt startu, který běží dřív, než je funkce definovaná. */
  applyTabRef: MutableRefObject<(tab: Tab) => void>;
  panels: readonly [Panel, Panel];
  splitOn: boolean;
  setSplitOn: Dispatch<SetStateAction<boolean>>;
  activePanel: 0 | 1;
  setActivePanel: Dispatch<SetStateAction<0 | 1>>;
  setOverlayPreview: (value: null) => void;
  setQuickLookOpen: Dispatch<SetStateAction<boolean>>;
  viewMode: ViewMode;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
};
