import type { FileEntry, TagMap } from "../../../shared/domain/types";

export type BuildToolbarTagItemsDeps = {
  targetEntries: FileEntry[];
  tags: TagMap;
  changeTags: (paths: string[], action: () => Promise<void>) => void;
};
