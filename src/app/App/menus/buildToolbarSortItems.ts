import type { SortKey } from "../../../shared/domain/format.types";
import { type MenuItem } from "../../../shared/ui/ContextMenu";
import { t } from "../../../shared/i18n/index";
import { SORT_LABELS } from "../constants";
import type { BuildToolbarSortItemsDeps } from "./buildToolbarSortItems.types";

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
