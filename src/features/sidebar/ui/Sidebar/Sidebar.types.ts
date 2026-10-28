import type { CustomFavorite, FavoriteEntry, FavoriteSection, FileEntry, RecentEntry, TagColor } from "../../../../shared/domain/types";
import type { DropInto } from "../../../file-list/application/rowDnd.types";
import type { ConfirmRequest } from "../../../dialogs/ui/ConfirmDialog";

export type SidebarProps = {
  sections: FavoriteSection[];
  currentPath: string | null;
  windowFocused: boolean;
  onNavigate: (path: string) => void;
  /** Otevře složku v nové záložce (prostřední tlačítko myši). */
  onOpenTab: (path: string) => void;
  /** Otevře soubor v systému (klik na nedávný soubor). */
  onOpenFile: (path: string, name: string) => void;
  /** Naviguje do rodičovské složky a označí v ní tuhle položku. */
  onReveal: (path: string) => void;
  activeTag: TagColor | null;
  onSelectTag: (color: TagColor) => void;
  /** Koš — poslední řádek sekce Zařízení; ikona podle počtu položek. */
  trashActive: boolean;
  trashCount: number;
  onOpenTrash: () => void;
  /** MI-FORK: Papelera en una pestaña nueva (botón central). */
  onOpenTrashTab: () => void;
  /** Položky (nebo soubory z Průzkumníku) puštěné na složku v sidebaru. */
  onDropInto: DropInto;
  /** Chyby (Průzkumník, Terminál, schránka) — do stejné hlášky jako v App. */
  onError: (message: string) => void;
  /** Potvrzení nevratné akce — dialog drží App, ať je jediný v aplikaci. */
  onConfirm: (request: ConfirmRequest) => void;
  /** MI-FORK: árbol — archivos ocultos y pestaña activa (cada una recuerda sus nodos). */
  showHidden: boolean;
  tabId: number;
};

/** Nadpis a pravý klik na něj — sdílí ho všechny sekce. */
export type HeadingControl = {
  collapsed: boolean;
  onToggle: () => void;
  onContextMenu: (x: number, y: number) => void;
};

export type CustomFavoritesProps = {
  items: CustomFavorite[];
  currentPath: string | null;
  windowFocused: boolean;
  onActivate: (item: CustomFavorite) => void;
  onContextMenu: (item: CustomFavorite, x: number, y: number) => void;
  renamingPath: string | null;
  onRenameSubmit: (path: string, label: string) => void;
  onRenameCancel: () => void;
  onOpenTab: (path: string) => void;
  heading: HeadingControl;
  /** MI-FORK: sección propia (undefined = «Acceso rápido»), título y si se ve vacía. */
  group: string | undefined;
  title: React.ReactNode;
  alwaysVisible?: boolean;
};

export type RecentsProps = {
  items: RecentEntry[];
  currentPath: string | null;
  windowFocused: boolean;
  onActivate: (entry: RecentEntry) => void;
  onContextMenu: (entry: RecentEntry, x: number, y: number) => void;
  onOpenTab: (path: string) => void;
  heading: HeadingControl;
  leaving: string | null;
};

export type TagsSectionProps = {
  counts: Map<TagColor, number>;
  activeTag: TagColor | null;
  windowFocused: boolean;
  onSelectTag: (color: TagColor) => void;
  onContextMenu: (color: TagColor, x: number, y: number) => void;
  heading: HeadingControl;
};

export type SidebarMenu =
  | { kind: "favorite"; x: number; y: number; item: CustomFavorite }
  | { kind: "recent"; x: number; y: number; entry: RecentEntry }
  /** Položka ze sekcí od backendu (Downloads, iCloud, Zařízení …). */
  | { kind: "section"; x: number; y: number; item: FavoriteEntry }
  | { kind: "tag"; x: number; y: number; color: TagColor }
  /** Nadpis sekce — sbalit/rozbalit, u Nedávných i vymazat. */
  | { kind: "heading"; x: number; y: number; id: string }
  /** Prázdný stav nebo volná plocha pod poslední sekcí. */
  | { kind: "background"; x: number; y: number }
  /** MI-FORK: fila del árbol de carpetas. */
  | { kind: "tree"; x: number; y: number; entry: FileEntry };
