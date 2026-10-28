import * as storage from "../../../shared/infrastructure/storage";
import { TAG_COLORS, tagLabel, TAG_HEX } from "../../../features/tags/application/tags";
import { type MenuItem } from "../../../shared/ui/ContextMenu";
import type { TagMap } from "../../../shared/domain/types";
import { type FileEntry } from "../../../shared/domain/types";

export type BuildToolbarTagItemsDeps = {
  targetEntries: FileEntry[];
  tags: TagMap;
  changeTags: (paths: string[], action: () => Promise<void>) => void;
};

export function buildToolbarTagItems(deps: BuildToolbarTagItemsDeps): MenuItem[] | null {
  const {
    targetEntries,
    tags,
    changeTags,
  } = deps;
  if (targetEntries.length === 0) return null;
  const paths = targetEntries.map((entry) => entry.path);

  return TAG_COLORS.map((color): MenuItem => {
    const everywhere = paths.every((path) => storage.tagsOf(tags, path).includes(color));
    return {
      type: "item",
      label: tagLabel(color),
      dot: TAG_HEX[color],
      checked: everywhere,
      onSelect: () => changeTags(paths, () => storage.setTag(paths, color, !everywhere)),
    };
  });
}
