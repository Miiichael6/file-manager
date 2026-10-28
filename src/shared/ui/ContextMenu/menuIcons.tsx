/* MI-FORK: ikony v kontextovém menu jako na referenčním snímku – tenká
   jednobarevná ikona před každou položkou. Položky se poznají podle
   přeloženého textu (App.tsx je skládá přes t()), takže se App.tsx nemění;
   text s počtem („Kopírovat 3 položky") se porovná s t(key, { count }).
   Položka, kterou nic nepozná, zůstane bez ikony a CSS (menu-style.css) ji
   odsadí, aby text lícoval s ostatními. */

import {
  AppWindow,
  ArrowUpDown,
  CircleMinus,
  CirclePlus,
  ClipboardPaste,
  Columns2,
  Copy,
  CopyPlus,
  Eraser,
  Eye,
  FolderOpen,
  FolderSearch,
  GitBranch,
  Info,
  LayoutGrid,
  Link2,
  ListChecks,
  MoveRight,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  SquareArrowOutUpRight,
  SquarePlus,
  SquareTerminal,
  Star,
  StarOff,
  TextCursorInput,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";

import type { MessageKey, Translate } from "../../i18n/index";
import type { MenuItem } from "./";

const ICONS: [MessageKey, LucideIcon][] = [
  ["menu.open", SquareArrowOutUpRight],
  ["menu.openInNewTab", SquarePlus],
  ["menu.showInFolder", FolderSearch],
  ["menu.quickLook", Eye],
  ["menu.openWith", AppWindow],
  ["menu.openInExplorer", FolderOpen],
  ["menu.openInTerminal", SquareTerminal],
  ["menu.addToFavorites", Star],
  ["menu.removeFromFavorites", StarOff],
  ["menu.rename", Pencil],
  ["menu.duplicate", CopyPlus],
  ["menu.copy", Copy],
  ["menu.copyCount", Copy],
  ["menu.cut", Scissors],
  ["menu.cutCount", Scissors],
  ["menu.paste", ClipboardPaste],
  ["split.copyToOther", Columns2],
  ["split.moveToOther", MoveRight],
  ["menu.copyPath", Link2],
  ["menu.copyPaths", Link2],
  ["menu.copyCurrentPath", Link2],
  ["menu.copyName", Type],
  ["menu.copyNames", Type],
  ["menu.editPath", TextCursorInput],
  ["menu.delete", Trash2],
  ["menu.deleteCount", Trash2],
  ["menu.removeTags", Eraser],
  ["git.stage", CirclePlus],
  ["git.unstage", CircleMinus],
  ["git.open", GitBranch],
  ["menu.new", Plus],
  ["menu.view", LayoutGrid],
  ["menu.sortBy", ArrowUpDown],
  ["menu.selectAll", ListChecks],
  ["menu.refresh", RefreshCw],
  ["menu.properties", Info],
  ["menu.folderProperties", Info],
];

/** Text → ikona pro daný jazyk (bez textů s počtem). */
const cache = new WeakMap<Translate, Map<string, LucideIcon>>();

function lookup(label: string, t: Translate): LucideIcon | undefined {
  let byLabel = cache.get(t);
  if (!byLabel) {
    byLabel = new Map();
    for (const [key, icon] of ICONS) {
      byLabel.set(t(key), icon);
      // Podmenu „Otevřít v aplikaci ▸" (folderApps.ts) je bez výpustky.
      byLabel.set(t(key).replace(/…$/, ""), icon);
    }
    cache.set(t, byLabel);
  }
  const found = byLabel.get(label);
  if (found) return found;

  const count = Number(/\d+/.exec(label)?.[0]);
  if (!Number.isFinite(count)) return undefined;
  return ICONS.find(([key]) => t(key, { count }) === label)?.[1];
}

/** Doplní ikony položkám nejvyšší úrovně, které vlastní ikonu nemají. */
export function withMenuIcons(items: MenuItem[], t: Translate): MenuItem[] {
  return items.map((item) => {
    if ((item.type !== "item" && item.type !== "submenu") || item.icon) return item;
    const Icon = lookup(item.label, t);
    return Icon ? { ...item, icon: <Icon size={15} strokeWidth={1.6} /> } : item;
  });
}
