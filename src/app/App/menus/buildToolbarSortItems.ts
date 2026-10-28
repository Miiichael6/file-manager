import type { Dispatch, SetStateAction } from "react";
import type { ViewMode } from "../../../shared/domain/types";
import type { SortDirection } from "../../../shared/domain/format";
import type { useExtras } from "../../../features/extras/application/useExtras";
import { type SortKey } from "../../../shared/domain/format";
import { type MenuItem } from "../../../shared/ui/ContextMenu";
import { t } from "../../../shared/i18n/index";
import { SORT_LABELS } from "../constants";

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
  return [
    ...(Object.keys(SORT_LABELS) as SortKey[]).map(
      (key): MenuItem => ({
        type: "item",
        label: t(SORT_LABELS[key]),
        checked: sortKey === key,
        onSelect: () => setSortKey(key),
      }),
    ),
    { type: "separator" },
    {
      type: "item",
      label: t("sort.ascending"),
      checked: sortDirection === "asc",
      onSelect: () => setSortDirection("asc"),
    },
    {
      type: "item",
      label: t("sort.descending"),
      checked: sortDirection === "desc",
      onSelect: () => setSortDirection("desc"),
    },
    // MI-FORK: «Agrupar por ▸» en la vista Lista.
    ...(viewMode === "list" ? [{ type: "separator" as const }, extras.groupByMenu()] : []),
  ];
}
