import { t, type MessageKey } from "../../../shared/i18n/index";
import { type MenuItem } from "../../../shared/ui/ContextMenu";

export type BuildToolbarShareItemsDeps = {
  sharePaths: string[];
  copyText: (text: string, failed: MessageKey) => void;
  putOnClipboard: (paths: string[], mode: "copy" | "cut") => void;
  revealInExplorer: (path: string) => void;
};

export function buildToolbarShareItems(deps: BuildToolbarShareItemsDeps): MenuItem[] {
  const {
    sharePaths,
    copyText,
    putOnClipboard,
    revealInExplorer,
  } = deps;
  const single = sharePaths.length === 1;
  const text = sharePaths.join("\r\n");

  return [
    {
      type: "item",
      label: single ? t("menu.copyPath") : t("menu.copyPaths"),
      disabled: sharePaths.length === 0,
      onSelect: () => copyText(text, single ? "op.copyPath" : "op.copyPaths"),
    },
    {
      type: "item",
      label: t("menu.copyFiles"),
      disabled: sharePaths.length === 0,
      // Jako soubory (CF_HDROP) — vloží je Průzkumník i příloha v mailu.
      onSelect: () => putOnClipboard(sharePaths, "copy"),
    },
    { type: "separator" },
    {
      type: "item",
      label: t("menu.openInExplorer"),
      disabled: sharePaths.length === 0,
      onSelect: () => revealInExplorer(sharePaths[0]),
    },
  ];
}
