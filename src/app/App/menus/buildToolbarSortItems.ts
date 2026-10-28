import type { Dispatch, SetStateAction } from "react";
import type { ViewMode } from "../../../shared/domain/types";
import type { SortDirection } from "../../../shared/domain/format";
import type { useExtras } from "../../../features/extras/application/useExtras";
import { type SortKey } from "../../../shared/domain/format";
import { type MenuItem } from "../../../shared/ui/ContextMenu";

export type BuildToolbarSortItemsDeps = {
  sortKey: SortKey;
  setSortKey: Dispatch<SetStateAction<SortKey>>;
  sortDirection: SortDirection;
  setSortDirection: Dispatch<SetStateAction<SortDirection>>;
  viewMode: ViewMode;
  extras: Pick<ReturnType<typeof useExtras>, "groupByMenu">;
};

export function buildToolbarSortItems(deps: BuildToolbarSortItemsDeps): MenuItem[] {
  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    viewMode,
    extras,
  } = deps;
return buildToolbarSortItems({ sortKey, setSortKey, sortDirection, setSortDirection, viewMode, extras });
}
