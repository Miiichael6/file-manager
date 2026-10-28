import type { MessageKey } from "../../../shared/i18n/index.types";

export type BuildToolbarShareItemsDeps = {
  sharePaths: string[];
  copyText: (text: string, failed: MessageKey) => void;
  putOnClipboard: (paths: string[], mode: "copy" | "cut") => void;
  revealInExplorer: (path: string) => void;
};
