import * as storage from "../../../shared/infrastructure/storage";
import { t, type MessageKey } from "../../../shared/i18n/index";
import { type MenuItem } from "../../../shared/ui/ContextMenu";
import { openWith, parentPath, type TerminalId } from "../../../shared/infrastructure/fileops";
import { folderOpenWithMenu } from "../../../features/toolbar/application/folderApps";
import { VIEW_LABELS, SORT_LABELS } from "../constants";
import { type ViewMode, type FileEntry } from "../../../shared/domain/types";
import { type SortKey, formatItemCount } from "../../../shared/domain/format";
import { folderEntry } from "../helpers";
import { TAG_COLORS } from "../../../features/tags/application/tags";
import { type MainMenu } from "../types";
import { type Tab, type TabSnapshot } from "../../../features/tabs/application/browser";

import type { Dispatch, SetStateAction } from "react";
import type { CustomFavorite, TagMap } from "../../../shared/domain/types";
import type { SortDirection } from "../../../shared/domain/format";
import type { DisplayNames } from "../../../features/file-list/application/extensions";
import type { FolderApp } from "../../../features/toolbar/application/folderApps";
import type { useExtras } from "../../../features/extras/application/useExtras";
import type { useGitIntegration } from "../../../features/git/application/useGitIntegration";

export type BuildContextMenuItemsDeps = {
  menu: MainMenu | null;
  copyText: (text: string, failed: MessageKey) => void;
  openTabs: Tab[];
  activeTabId: number;
  splitOn: boolean;
  separateTab: (id: number) => void;
  closeTab: (id: number) => void;
  closeOtherTabs: (id: number) => void;
  setPathEditing: Dispatch<SetStateAction<boolean>>;
  openFile: (entry: FileEntry) => void;
  runOperation: (label: MessageKey, action: () => Promise<unknown>) => Promise<void>;
  revealInExplorer: (path: string) => void;
  favorites: CustomFavorite[];
  newMenuEntries: (dir: string) => Extract<MenuItem, { type: "item"; } | { type: "separator"; }>[];
  clipboardHasItems: boolean;
  paste: (into?: string) => void;
  folderApps: FolderApp[];
  openTerminalAt: (path: string, terminal?: TerminalId) => void;
  terminalItems: (path: string) => Extract<MenuItem, { type: "item"; }>[];
  viewMode: ViewMode;
  changeViewMode: (mode: ViewMode) => void;
  showHidden: boolean | null;
  toggleHidden: () => void;
  extras: Pick<ReturnType<typeof useExtras>, "menuItems" | "groupByMenu" | "folderSizesItem">;
  sortKey: SortKey;
  setSortKey: Dispatch<SetStateAction<SortKey>>;
  sortDirection: SortDirection;
  setSortDirection: Dispatch<SetStateAction<SortDirection>>;
  isColumnView: boolean;
  visibleEntries: FileEntry[];
  selectAll: () => void;
  refresh: () => void;
  setPropertiesFor: Dispatch<SetStateAction<FileEntry | null>>;
  targetEntries: FileEntry[];
  tags: TagMap;
  openFromResults: (entry: FileEntry) => void;
  open: (entry: FileEntry) => void;
  openTab: (path: string | null, overlay?: Partial<TabSnapshot> | undefined) => void;
  reveal: (path: string, rename?: boolean) => void;
  setOverlayPreview: Dispatch<SetStateAction<FileEntry | null>>;
  previewEntry: (entry: FileEntry) => void;
  names: DisplayNames;
  setRenamingPath: Dispatch<SetStateAction<string | null>>;
  duplicateEntry: (entry: FileEntry, select?: boolean) => void;
  copyToClipboard: (mode: "copy" | "cut", items?: FileEntry[]) => void;
  otherDir: string | null;
  transferToOther: (mode: "copy" | "cut", items?: FileEntry[]) => void;
  deleteEntries: (items: FileEntry[], permanent?: boolean) => void;
  changeTags: (paths: string[], action: () => Promise<void>) => void;
  git: Pick<ReturnType<typeof useGitIntegration>, "menuItems">;
};

export function buildContextMenuItems(deps: BuildContextMenuItemsDeps): MenuItem[] {
  const {
    menu,
    copyText,
    openTabs,
    activeTabId,
    splitOn,
    separateTab,
    closeTab,
    closeOtherTabs,
    setPathEditing,
    openFile,
    runOperation,
    revealInExplorer,
    favorites,
    newMenuEntries,
    clipboardHasItems,
    paste,
    folderApps,
    openTerminalAt,
    terminalItems,
    viewMode,
    changeViewMode,
    showHidden,
    toggleHidden,
    extras,
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    isColumnView,
    visibleEntries,
    selectAll,
    refresh,
    setPropertiesFor,
    targetEntries,
    tags,
    openFromResults,
    open,
    openTab,
    reveal,
    setOverlayPreview,
    previewEntry,
    names,
    setRenamingPath,
    duplicateEntry,
    copyToClipboard,
    otherDir,
    transferToOther,
    deleteEntries,
    changeTags,
    git,
  } = deps;
  if (menu === null) return [];

  const copyPathItem = (path: string, label = t("menu.copyPath")): MenuItem => ({
    type: "item",
    label,
    onSelect: () => copyText(path, "op.copyPath"),
  });

  if (menu.kind === "tab") {
    const target = openTabs.find((tab) => tab.id === menu.id);
    const isSplit = menu.id === activeTabId ? splitOn : target?.split === true && target.second !== undefined;
    return [
      {
        type: "item",
        label: t("split.separate"),
        shortcut: menu.id === activeTabId ? "Ctrl+Shift+E" : undefined,
        disabled: !isSplit,
        onSelect: () => separateTab(menu.id),
      },
      { type: "separator" },
      {
        type: "item",
        label: t("tabs.close"),
        shortcut: menu.id === activeTabId ? "Ctrl+W" : undefined,
        disabled: openTabs.length <= 1,
        onSelect: () => closeTab(menu.id),
      },
      {
        type: "item",
        label: t("tabs.closeOthers"),
        disabled: openTabs.length <= 1,
        onSelect: () => closeOtherTabs(menu.id),
      },
    ];
  }

  if (menu.kind === "status") {
    return [
      copyPathItem(menu.dir, t("menu.copyCurrentPath")),
      { type: "item", label: t("menu.editPath"), shortcut: "Ctrl+L", onSelect: () => setPathEditing(true) },
    ];
  }

  if (menu.kind === "quicklook") {
    const { entry } = menu;

    return [
      { type: "item", label: t("menu.open"), onSelect: () => openFile(entry) },
      // MI-FORK: «Abrir con…» también desde la vista previa.
      {
        type: "item",
        label: t("menu.openWith"),
        onSelect: () => void runOperation("op.openWith", () => openWith(entry.path)),
      },
      {
        type: "item",
        label: t("menu.openInExplorer"),
        onSelect: () => revealInExplorer(entry.path),
      },
      { type: "separator" },
      copyPathItem(entry.path),
    ];
  }

  if (menu.kind === "background") {
    const { dir } = menu;
    const dirIsFavorite = favorites.some((item) => storage.samePath(item.path, dir));

    return [
      { type: "submenu", label: t("menu.new"), items: newMenuEntries(dir) },
      { type: "separator" },
      {
        type: "item",
        label: t("menu.paste"),
        shortcut: "Ctrl+V",
        disabled: !clipboardHasItems,
        onSelect: () => paste(dir),
      },
      { type: "separator" },
      folderOpenWithMenu(dir, folderApps, t, (label, action) => void runOperation(label, action), false), // MI-FORK
      {
        type: "item",
        label: t("menu.openInExplorer"),
        onSelect: () => revealInExplorer(dir),
      },
      {
        type: "item",
        label: t("menu.openInTerminal"),
        onSelect: () => openTerminalAt(dir),
        shiftItems: terminalItems(dir),
      },
      copyPathItem(dir),
      { type: "separator" },
      {
        type: "submenu",
        label: t("menu.view"),
        items: [
          ...(Object.keys(VIEW_LABELS) as ViewMode[]).map(
            (mode): MenuItem & { type: "item" } => ({
              type: "item",
              label: t(VIEW_LABELS[mode]),
              checked: viewMode === mode,
              onSelect: () => changeViewMode(mode),
            }),
          ),
          { type: "separator" },
          {
            type: "item",
            label: t("menu.hiddenFiles"),
            shortcut: "Ctrl+Shift+.",
            checked: showHidden === true,
            onSelect: toggleHidden,
          },
          extras.folderSizesItem(), // MI-FORK
        ],
      },
      {
        type: "submenu",
        label: t("menu.sortBy"),
        items: [
          ...(Object.keys(SORT_LABELS) as SortKey[]).map(
            (key): MenuItem & { type: "item" } => ({
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
          // MI-FORK: «Agrupar por ▸» (solo la vista Lista agrupa).
          ...(viewMode === "list" ? [{ type: "separator" as const }, extras.groupByMenu()] : []),
        ],
      },
      { type: "separator" },
      {
        type: "item",
        label: t("menu.selectAll"),
        shortcut: "Ctrl+A",
        // V column view výběr celé složky neexistuje, řádky jsou po jednom.
        disabled: isColumnView || visibleEntries.length === 0,
        onSelect: selectAll,
      },
      { type: "item", label: t("menu.refresh"), shortcut: "F5", onSelect: refresh },
      // Bez tohohle šlo do sidebaru dostat jen složku, kterou uživatel vidí
      // ve výpisu — tu, ve které zrovna stojí, nijak.
      {
        type: "item",
        label: dirIsFavorite ? t("menu.removeFromFavorites") : t("menu.addToFavorites"),
        onSelect: () => {
          if (dirIsFavorite) void storage.removeFavorite(dir);
          else
            void storage.addFavorite({
              label: storage.lastSegment(dir),
              path: dir,
              icon: "Folder",
              type: "folder",
            });
        },
      },
      { type: "separator" },
      {
        type: "item",
        label: t("menu.folderProperties"),
        onSelect: () => setPropertiesFor(folderEntry(dir)),
      },
    ];
  }

  const { entry, overlay } = menu;
  // Ve výsledcích hledání a v tag view míří všechno jen na položku pod myší.
  const targets = overlay ? [entry] : targetEntries;
  const count = targets.length;
  // Operace pro jednu položku nemají u víceřádkového výběru co dělat —
  // přejmenovat pět souborů jedním inputem nejde a Vlastnosti by ukázaly jedny.
  const single = count <= 1;
  const isFavorite = favorites.some((item) => storage.samePath(item.path, entry.path));
  const entryTags = storage.tagsOf(tags, entry.path);
  // Vložit z výsledků hledání míří do té složky (nebo do složky toho souboru),
  // na kterou uživatel klikl — podkladová složka pod výsledky není vidět.
  const pasteTarget = overlay ? (entry.is_dir ? entry.path : parentPath(entry.path)) : undefined;

  // null = položka, která se v tomhle menu nehodí (náhled u složky, oblíbené
  // u souboru). Vyfiltruje se až nakonec, aby se seznam dal psát lineárně.
  // Tagy celého výběru: barva je "zapnutá", když ji mají všechny položky.
  const targetPaths = targets.map((item) => item.path);
  const sharedTags = TAG_COLORS.filter((color) =>
    targetPaths.every((path) => storage.tagsOf(tags, path).includes(color)),
  );
  const anyTags = targetPaths.some((path) => storage.tagsOf(tags, path).length > 0);

  const items: (MenuItem | null)[] = [
    // Menu nad výběrem víc položek řekne rovnou, na kolik míří.
    single ? null : { type: "header", label: formatItemCount(count) },
    {
      type: "item",
      label: t("menu.open"),
      shortcut: "Enter",
      // open() by soubor označil v podkladové složce, kde vůbec není.
      onSelect: () => (overlay ? openFromResults(entry) : open(entry)),
    },
    entry.is_dir
      ? { type: "item", label: t("menu.openInNewTab"), onSelect: () => openTab(entry.path) }
      : null,
    // Výsledky hledání a tag view jsou rozcestník — odtud se položka odkrývá
    // v její složce (dřív to dělal jeden klik).
    overlay && parentPath(entry.path) !== null
      ? {
          type: "item",
          label: t("menu.showInFolder"),
          onSelect: () => reveal(entry.path),
        }
      : null,
    entry.is_dir
      ? null
      : {
          type: "item",
          label: t("menu.quickLook"),
          shortcut: "Space",
          onSelect: () => (overlay ? setOverlayPreview(entry) : previewEntry(entry)),
        },
    entry.is_dir
      ? folderOpenWithMenu(entry.path, folderApps, t, (label, action) => void runOperation(label, action), !single) // MI-FORK
      : {
          type: "item",
          label: t("menu.openWith"),
          disabled: !single,
          onSelect: () => {
            void runOperation("op.openWith", () => openWith(entry.path));
          },
        },
    { type: "separator" },
    {
      type: "item",
      label: t("menu.openInExplorer"),
      disabled: !single,
      onSelect: () => revealInExplorer(entry.path),
    },
    {
      type: "item",
      label: t("menu.openInTerminal"),
      disabled: !single,
      onSelect: () => openTerminalAt(entry.path),
      shiftItems: terminalItems(entry.path),
    },
    // Do "Moje oblíbené" smí složka i soubor: klik na složku tam naviguje,
    // klik na soubor ho otevře v systémové aplikaci.
    {
      type: "item",
      label: isFavorite ? t("menu.removeFromFavorites") : t("menu.addToFavorites"),
      disabled: !single,
      onSelect: () => {
        if (isFavorite) void storage.removeFavorite(entry.path);
        else
          void storage.addFavorite({
            label: names.entry(entry),
            path: entry.path,
            icon: "Folder",
            type: entry.is_dir ? "folder" : "file",
          });
      },
    },
    { type: "separator" },
    {
      type: "item",
      label: t("menu.rename"),
      shortcut: "F2",
      disabled: !single,
      // Výsledky hledání nemají inline přejmenování — odkryje se položka v její
      // složce a přejmenování se otevře až tam.
      onSelect: () => {
        if (overlay) reveal(entry.path, true);
        else setRenamingPath(entry.path);
      },
    },
    {
      type: "item",
      label: t("menu.duplicate"),
      shortcut: "Ctrl+D",
      disabled: !single,
      onSelect: () => duplicateEntry(entry, !overlay),
    },
    { type: "separator" },
    {
      type: "item",
      label: single ? t("menu.copy") : t("menu.copyCount", { count }),
      shortcut: "Ctrl+C",
      onSelect: () => copyToClipboard("copy", targets),
    },
    {
      type: "item",
      label: single ? t("menu.cut") : t("menu.cutCount", { count }),
      shortcut: "Ctrl+X",
      onSelect: () => copyToClipboard("cut", targets),
    },
    {
      type: "item",
      label: t("menu.paste"),
      shortcut: "Ctrl+V",
      disabled: !clipboardHasItems || pasteTarget === null,
      onSelect: () => paste(pasteTarget ?? undefined),
    },
    otherDir === null || overlay ? null : { type: "separator" },
    otherDir === null || overlay
      ? null
      : { type: "item", label: t("split.copyToOther"), shortcut: "F5", onSelect: () => transferToOther("copy", targets) },
    otherDir === null || overlay
      ? null
      : { type: "item", label: t("split.moveToOther"), shortcut: "F6", onSelect: () => transferToOther("cut", targets) },
    { type: "separator" },
    {
      type: "item",
      label: single ? t("menu.copyPath") : t("menu.copyPaths"),
      // U výběru se kopírují všechny cesty po řádcích — tak je vezme každý editor.
      onSelect: () =>
        copyText(
          single ? entry.path : targets.map((item) => item.path).join("\r\n"),
          single ? "op.copyPath" : "op.copyPaths",
        ),
    },
    {
      type: "item",
      label: single ? t("menu.copyName") : t("menu.copyNames"),
      onSelect: () =>
        copyText(
          single ? entry.name : targets.map((item) => item.name).join("\r\n"),
          single ? "op.copyName" : "op.copyNames",
        ),
    },
    { type: "separator" },
    {
      type: "item",
      label: single ? t("menu.delete") : t("menu.deleteCount", { count }),
      shortcut: "Delete",
      danger: true,
      onSelect: () => deleteEntries(targets),
    },
    { type: "separator" },
    {
      type: "tags",
      label: t("menu.tags"),
      active: single ? entryTags : sharedTags,
      // U výběru se barva přidá všem (nebo všem odebere, když ji mají všichni).
      onToggle: (color) =>
        single
          ? changeTags([entry.path], () => storage.toggleTag(entry.path, color))
          : changeTags(targetPaths, () => storage.setTag(targetPaths, color, !sharedTags.includes(color))),
    },
    !anyTags
      ? null
      : {
          type: "item",
          label: t("menu.removeTags"),
          onSelect: () =>
            changeTags(targetPaths, async () => {
              for (const path of targetPaths) await storage.clearTags(path);
            }),
        },
    // MI-FORK: ZIP, renombrar varios, comparar.
    ...extras.menuItems(targets),
    // MI-FORK: Git integrado (Stage / Unstage).
    ...git.menuItems(targets),
    { type: "separator" },
    {
      type: "item",
      label: t("menu.properties"),
      disabled: !single,
      onSelect: () => setPropertiesFor(entry),
    },
  ];

  return items.filter((item): item is MenuItem => item !== null);
}
