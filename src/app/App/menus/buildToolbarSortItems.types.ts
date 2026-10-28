import type { SortDirection, SortKey } from "../../../shared/domain/format.types";
import type { Dispatch, SetStateAction } from "react";
import type { ViewMode } from "../../../shared/domain/types";
import type { useExtras } from "../../../features/extras/application/useExtras";

export type BuildToolbarSortItemsDeps = {
  sortKey: SortKey;
  setSortKey: Dispatch<SetStateAction<SortKey>>;
  sortDirection: SortDirection;
  setSortDirection: Dispatch<SetStateAction<SortDirection>>;
  viewMode: ViewMode;
  extras: Pick<ReturnType<typeof useExtras>, "groupByMenu">;
};
