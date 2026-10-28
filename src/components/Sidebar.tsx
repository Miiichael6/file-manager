import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Folder, Trash2 } from "lucide-react";

import { writeText } from "@tauri-apps/plugin-clipboard-manager";

import { ContextMenu, type MenuItem } from "./ContextMenu";
import { fileVisual, sidebarIcon, sidebarIconColor, sidebarLabel } from "./icons";
import { openDevice, openInExplorer, openTerminal, openWith, parentPath } from "../fileops";
import { formatRelative } from "../format";
import { failure, useT, type MessageKey } from "../i18n";
import type { ConfirmRequest } from "./ConfirmDialog";
import { isTypingTarget } from "../lib/dom";
import {
  canDropInto,
  droppedPaths,
  EMPTY_DRAG_IMAGE,
  endDrag,
  getDrag,
  isExternalFileDrag,
  startDrag,
  useDrag,
} from "../lib/dnd";
import type { DropInto } from "../lib/rowDnd";
import * as storage from "../lib/storage";
import { TAG_COLORS, TAG_HEX, tagLabel } from "../lib/tags";
import { useStorage } from "../lib/useStorage";
import type {
  CustomFavorite,
  FavoriteEntry,
  FavoriteSection,
  RecentEntry,
  RecentKind,
  SectionId,
  TagColor,
} from "../types";
import { useDisplayNames } from "../lib/extensions";
// MI-FORK: árbol de carpetas y Git en el sidebar.
import { listen } from "@tauri-apps/api/event";
import { FolderTree, TreeToggle, handleTreeKey } from "./FolderTree";
import { GitBadge } from "./GitBadge";
import * as tree from "../lib/folderTree";
import type { FileEntry } from "../types";
import "../mi-fork/folder-tree.css";
import { DriveDonut, driveUsageText, useDriveUsage } from "../mi-fork/DriveUsage";
// MI-FORK: secciones propias en el sidebar.
import * as sidebarGroups from "../mi-fork/sidebarGroups";

/** Nedávných se ukládá 20, ale sidebar by z nich neúměrně narostl. */
const RECENTS_SHOWN = 10;

/** Klíče sekcí pro sbalení. Sekce od backendu mají klíč `system:<id>`. */
const CUSTOM_ID = "custom";
/** MI-FORK: secciones propias — clave `group:<id>`. */
const GROUP_PREFIX = "group:";
const RECENTS_ID = "recents";
const TAGS_ID = "tags";

type SidebarProps = {
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

/* -------------------------- sdílené stavební díly -------------------------- */

const SECTION_TITLES: Record<SectionId, MessageKey> = {
  favorites: "sidebar.favorites",
  cloud: "sidebar.cloud",
  devices: "sidebar.devices",
};

/** Sbalené sekce přežijí restart. Jde o pohodlí jednoho uživatele, ne o data,
 *  takže stačí localStorage stejně jako u tématu. */
const COLLAPSED_KEY = "finder-sidebar-collapsed";

/** Do verze 1.1 se sekce od backendu klíčovaly českým názvem. */
const LEGACY_SECTION_KEYS: Record<string, string> = {
  "system:Oblíbené": "system:favorites", // i18n-ignore
  "system:Cloud": "system:cloud",
  "system:Zařízení": "system:devices", // i18n-ignore
};

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    return new Set(ids.map((id) => LEGACY_SECTION_KEYS[id] ?? id));
  } catch {
    return new Set();
  }
}

function writeCollapsed(ids: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Bez úložiště se sbalení prostě nezapamatuje.
  }
}

/** Nadpis a pravý klik na něj — sdílí ho všechny sekce. */
type HeadingControl = {
  collapsed: boolean;
  onToggle: () => void;
  onContextMenu: (x: number, y: number) => void;
};

function SectionHeading({
  children,
  control,
}: {
  children: React.ReactNode;
  control: HeadingControl;
}) {
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-expanded={!control.collapsed}
      onClick={control.onToggle}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        control.onContextMenu(event.clientX, event.clientY);
      }}
      className="fw-section-heading group flex cursor-default items-center"
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {/* Jako ve Finderu: šipka sbalení se ukáže jen při najetí na nadpis. */}
      <ChevronDown
        size={12}
        strokeWidth={2.5}
        className={`fw-t-reveal shrink-0 opacity-0 group-hover:opacity-100 ${
          control.collapsed ? "-rotate-90" : ""
        }`}
      />
    </div>
  );
}

/**
 * Obsah sekce zůstává v DOM a sbalení animuje výšku (grid 0fr ↔ 1fr) s
 * prolnutím — okamžité zmizení řádků působilo trhaně.
 */
function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="fw-collapse" data-collapsed={!open} inert={!open}>
      <div className="fw-collapse-inner">{children}</div>
    </div>
  );
}

/** Společný vzhled všech řádků sidebaru, ať už jde o složku, tag nebo nedávný soubor. */
const ROW_CLASS =
  "fw-sidebar-row flex h-[24px] items-center gap-2 px-3 text-left text-[13px] text-primary"; // MI-FORK: fila plana a todo el ancho (estilo TablePlus)

/**
 * Hover posun i podbarvení řeší .fw-sidebar-row v CSS — jen tam jde napsat
 * "posuň při hoveru, ale ne když je řádek aktivní" bez druhé sady tříd.
 */
/** MI-FORK: botón central — mousedown evita el autoscroll; auxclick abre la pestaña. */
function preventMiddleScroll(event: React.MouseEvent) {
  if (event.button === 1) event.preventDefault();
}

function rowStateClass(active: boolean, windowFocused: boolean): string {
  if (!active) return "";
  return windowFocused ? "is-active" : "is-active-dim";
}

/** Ikona aktivního řádku se o kus zesvětlí, ať výběr čte i bez pozadí. */
function iconColor(base: string, active: boolean): string {
  // Zesvětlení patří modrému výběru; šedý výběr skla ve světlém tématu ikonu
  // naopak ztmaví (--sidebar-icon-mix v index.css), jinak by splývala.
  return active ? `color-mix(in srgb, ${base} 85%, var(--sidebar-icon-mix, white))` : base;
}

/** Výška řádku (ROW_CLASS h-[24px]) — posuny při přerovnání počítají s ní. */
const ROW_HEIGHT = 24;

/** Popisek se edituje volně — na rozdíl od názvu souboru ho Windows neomezují. */
function LabelInput({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit() {
    if (finished.current) return;
    finished.current = true;
    const trimmed = value.trim();
    if (trimmed === "") onCancel();
    else onSubmit(trimmed);
  }

  function cancel() {
    if (finished.current) return;
    finished.current = true;
    onCancel();
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      spellCheck={false}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={submit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      className="min-w-0 flex-1 rounded-sm px-1 text-[13px] text-primary outline-none"
      style={{
        background: "var(--bg-main)",
        border: "1px solid var(--accent)",
        userSelect: "text",
      }}
    />
  );
}

/* --------------------------- MOJE OBLÍBENÉ -------------------------------- */

type CustomFavoritesProps = {
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

function CustomFavorites({
  items,
  onOpenTab,
  currentPath,
  windowFocused,
  onActivate,
  onContextMenu,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  heading,
  group,
  title,
  alwaysVisible = false,
}: CustomFavoritesProps) {
  const names = useDisplayNames();
  const t = useT();
  const drag = useDrag();
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // MI-FORK: el favorito arrastrado puede venir de otra sección — entonces aquí
  // no es «origen» sino un elemento que entra (como una carpeta del listado).
  const sourceIndex =
    drag?.kind === "favorite" ? items.findIndex((item) => storage.samePath(item.path, drag.path)) : -1;
  const source = sourceIndex >= 0 ? sourceIndex : null;
  const foreignFavorite =
    drag?.kind === "favorite" && source === null
      ? (storage.getSnapshot().favorites.find((item) => storage.samePath(item.path, drag.path)) ?? null)
      : null;

  // Soubor i složka sem smí, ale co už v seznamu je, se podruhé nepřidává.
  // U vícenásobného tažení stačí, když je aspoň jedna položka nová.
  // MI-FORK: un favorito de otra sección sí entra (se mueve), pero un archivo
  // que ya es favorito en otra sección no (sería un duplicado).
  // MI-FORK: složka ze sidebaru (place) se přidá jako oblíbená, pokud ještě není.
  const isFavorite = (path: string) => storage.getSnapshot().favorites.some((item) => storage.samePath(item.path, path));
  const accepts =
    drag !== null &&
    (drag.kind === "favorite" ||
      (drag.kind === "place" ? !isFavorite(drag.path) : drag.items.some((dragged) => !isFavorite(dragged.path))));

  // Prázdná sekce se odhalí jen na dobu tažení, aby bylo kam pustit první složku.
  const visible = items.length > 0 || alwaysVisible || (accepts && source === null);
  if (!visible) return null;

  /**
   * Pozice mezi řádky podle výšky kurzoru. Počítá se z geometrie seznamu, ne
   * z řádku pod myší — řádky během tažení uhýbají transformací a hit-test by
   * mezi dvěma pozicemi přeskakoval.
   */
  function indexAt(clientY: number): number {
    const top = navRef.current?.getBoundingClientRect().top ?? clientY;
    return Math.max(0, Math.min(items.length, Math.round((clientY - top) / ROW_HEIGHT)));
  }

  function allowInSection(event: React.DragEvent) {
    if (!accepts) return;
    // Bez preventDefault prohlížeč drop vůbec nepustí — tím se odmítají soubory.
    event.preventDefault();
    event.dataTransfer.dropEffect = drag?.kind === "favorite" ? "move" : "copy";
    setDropIndex(indexAt(event.clientY));
  }

  // Přerovnání: tažený řádek zůstává jako průsvitný duch a odjede na cílové
  // místo, řádky mezi uhnou o jeden. Zvenku (ze složky) uhnou řádky pod
  // pozicí a do mezery se vloží duch přidávané položky. Jen transformace —
  // layout seznamu se během tažení nehne.
  // MI-FORK: el «fantasma» que entra también puede ser un favorito de otra sección.
  const incoming =
    dropIndex === null
      ? null
      : drag?.kind === "entry"
        ? drag.items.map((item) => ({
            name: names.name(item.name, item.isDir),
            path: item.path,
            type: (item.isDir ? "folder" : "file") as RecentKind,
          }))
        : drag?.kind === "place"
          ? [{ name: drag.name, path: drag.path, type: "folder" as RecentKind }]
          : foreignFavorite
            ? [{ name: foreignFavorite.label, path: foreignFavorite.path, type: foreignFavorite.type }]
            : null;

  function offsetOf(index: number): number {
    if (dropIndex === null) return 0;
    if (source === null) return index >= dropIndex ? ROW_HEIGHT : 0;
    const final = dropIndex > source ? dropIndex - 1 : dropIndex;
    if (index === source) return (final - source) * ROW_HEIGHT;
    if (index > source && index <= final) return -ROW_HEIGHT;
    if (index < source && index >= final) return ROW_HEIGHT;
    return 0;
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();

    const payload = getDrag();
    const target = dropIndex ?? items.length;
    setDropIndex(null);
    endDrag();

    if (payload === null) return;

    // MI-FORK: reordenar o mover entre secciones (sidebarGroups) en vez de moveFavorite.
    if (payload.kind === "favorite") {
      void sidebarGroups.moveFavoriteTo(payload.path, group, target);
      return;
    }
    if (payload.kind === "place") {
      void sidebarGroups.addFavoriteTo(
        { label: payload.name, path: payload.path, icon: "Folder", type: "folder" },
        group,
        target,
      );
      return;
    }

    // Celý výběr na místo, kam ukazovala linka, v pořadí výpisu. Duplicity
    // addFavorite sám odmítne — a pozice se posune jen o přidané.
    void (async () => {
      let at = target;
      for (const item of payload.items) {
        const added = await sidebarGroups.addFavoriteTo(
          { label: item.name, path: item.path, icon: "Folder", type: item.isDir ? "folder" : "file" },
          group,
          at,
        );
        if (added) at += 1;
      }
    })();
  }

  return (
    <div
      onDragOver={allowInSection}
      onDragLeave={(event) => {
        // Přechod mezi řádky uvnitř sekce se za odchod nepočítá.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null);
      }}
      onDrop={handleDrop}
    >
      <SectionHeading control={heading}>{title}</SectionHeading>

      {/* Sbalená sekce se během tažení otevře — jinak by nebylo kam pustit. */}
      <Collapsible open={!heading.collapsed || accepts}>
        <nav ref={navRef} className="relative flex flex-col pb-0.5">
          {items.map((item, index) => {
            // Soubor v sidebaru nikdy "nejsme uvnitř" — zvýrazňují se jen složky.
            const isActive =
              item.type === "folder" &&
              currentPath !== null &&
              storage.samePath(item.path, currentPath);
            const isRenaming = item.path === renamingPath;

            return (
              <div
                key={item.path}
                style={{
                  transform: `translateY(${offsetOf(index)}px)`,
                  // Jen během tažení. Po puštění se pořadí změní v DOM a posun
                  // spadne na nulu naráz — řádek už stojí na svém novém místě.
                  transition: drag !== null ? "transform var(--dur-shift) var(--ease-out)" : undefined,
                  opacity: index === source ? 0.45 : undefined,
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  data-tooltip={item.path}
                  draggable={!isRenaming}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    setDropIndex(null);
                    startDrag(
                      { kind: "favorite", path: item.path, index, isDir: item.type === "folder" },
                      event.dataTransfer,
                    );
                    // MI-FORK: složku provází duch z App (jako ouško), soubor nativní obrázek.
                    if (item.type === "folder") event.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
                  }}
                  onDragEnd={() => {
                    setDropIndex(null);
                    endDrag();
                  }}
                  onClick={() => !isRenaming && onActivate(item)}
                  // MI-FORK: botón central = pestaña nueva (solo carpetas).
                  onMouseDown={preventMiddleScroll}
                  onAuxClick={(event) => {
                    if (event.button === 1 && !isRenaming && item.type === "folder") onOpenTab(item.path);
                  }}
                  onContextMenu={(event) => {
                    if (isTypingTarget(event.target)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onContextMenu(item, event.clientX, event.clientY);
                  }}
                  className={`${ROW_CLASS} ${rowStateClass(isActive && !isRenaming, windowFocused)}`}
                >
                  <EntryIcon
                    name={item.label}
                    path={item.path}
                    type={item.type}
                    active={isActive}
                    folderIcon={item.icon}
                  />

                  {isRenaming ? (
                    <LabelInput
                      initial={item.label}
                      onSubmit={(label) => onRenameSubmit(item.path, label)}
                      onCancel={onRenameCancel}
                    />
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Duch položky, která se sem přidává — v mezeře, kterou řádky udělaly. */}
          {incoming && dropIndex !== null && incoming[0] && (
            <>
              <div
                aria-hidden
                className={`${ROW_CLASS} pointer-events-none absolute right-0 left-0`}
                style={{ top: dropIndex * ROW_HEIGHT, opacity: 0.45 }}
              >
                <EntryIcon
                  name={storage.lastSegment(incoming[0].path)}
                  path={incoming[0].path}
                  type={incoming[0].type}
                  active={false}
                />
                <span className="truncate">
                  {incoming.length > 1 ? `${incoming[0].name} +${incoming.length - 1}` : incoming[0].name}
                </span>
              </div>
              {/* Místo pro řádek navíc, ať poslední uhnutý nevjede do další sekce. */}
              <div aria-hidden style={{ height: ROW_HEIGHT }} />
            </>
          )}

          {items.length === 0 && !incoming && (
            <div className="mx-1.5 px-3 py-1 text-[12px] text-secondary italic">
              {t("sidebar.dropHere")}
            </div>
          )}
        </nav>
      </Collapsible>
    </div>
  );
}

/** MI-FORK: řádek složky jako zdroj tažení — do panelu vlevo / vpravo / nová záložka. */
function placeDragProps(path: string, name: string) {
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.stopPropagation();
      startDrag({ kind: "place", path, name }, event.dataTransfer);
      event.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
    },
    onDragEnd: () => endDrag(),
  };
}

/* ------------------------------- NEDÁVNÉ ---------------------------------- */

/**
 * Ikona řádku, který může být soubor i složka — tak vypadají nedávné
 * i oblíbené. `folderIcon` nechává vlastní oblíbené použít ikonu ze
 * settings.json, nedávné vždycky kreslí prostou složku.
 */
function EntryIcon({
  name,
  path,
  type,
  active,
  folderIcon,
  muted = false,
}: {
  name: string;
  path: string;
  type: RecentKind;
  active: boolean;
  folderIcon?: string;
  /** Mimo Oblíbené jsou ikony tlumené (Finder Sonoma: modré jen Oblíbené). */
  muted?: boolean;
}) {
  if (type === "folder") {
    const Icon = folderIcon === undefined ? Folder : sidebarIcon(folderIcon);

    return (
      <Icon
        size={16}
        strokeWidth={1.75}
        className="fw-sidebar-icon shrink-0"
        color={iconColor(muted ? "var(--text-secondary)" : "var(--sidebar-accent)", active)}
      />
    );
  }

  const extension = name.includes(".")
    ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
    : null;

  const { Icon, tint } = fileVisual({
    name,
    path,
    is_dir: false,
    size: 0,
    modified: 0,
    created: 0,
    extension,
    hidden: false,
    is_symlink: false,
  });

  return (
    <Icon
      size={16}
      strokeWidth={1.75}
      className="fw-sidebar-icon shrink-0"
      color={iconColor(muted ? "var(--text-secondary)" : tint, active)}
    />
  );
}

type RecentsProps = {
  items: RecentEntry[];
  currentPath: string | null;
  windowFocused: boolean;
  onActivate: (entry: RecentEntry) => void;
  onContextMenu: (entry: RecentEntry, x: number, y: number) => void;
  onOpenTab: (path: string) => void;
  heading: HeadingControl;
  leaving: string | null;
};

function Recents({
  items,
  leaving,
  onOpenTab,
  currentPath,
  windowFocused,
  onActivate,
  onContextMenu,
  heading,
}: RecentsProps) {
  const names = useDisplayNames();
  const t = useT();
  const shown = items.slice(0, RECENTS_SHOWN);

  return (
    <div className="fw-sidebar-section">
      <SectionHeading control={heading}>{t("sidebar.recents")}</SectionHeading>

      <Collapsible open={!heading.collapsed}>
        <nav className="flex flex-col pb-0.5">
          {shown.length === 0 && (
            <div className="mx-1.5 px-3 py-1 text-[12px] text-secondary italic">
              {t("sidebar.nothingYet")}
            </div>
          )}

          {shown.map((entry) => {
            const isActive =
              entry.type === "folder" &&
              currentPath !== null &&
              storage.samePath(entry.path, currentPath);

            return (
              <button
                key={entry.path}
                type="button"
                data-tooltip={entry.path}
                onClick={() => onActivate(entry)}
                {...(entry.type === "folder" ? placeDragProps(entry.path, entry.name) : {})}
                // Prostřední tlačítko: mousedown zabrání autoscrollu, auxclick otevře záložku.
                onMouseDown={(event) => {
                  if (event.button === 1) event.preventDefault();
                }}
                onAuxClick={(event) => {
                  if (event.button === 1 && entry.type === "folder") onOpenTab(entry.path);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onContextMenu(entry, event.clientX, event.clientY);
                }}
                className={`${ROW_CLASS} ${rowStateClass(isActive, windowFocused)}${entry.path === leaving ? " fw-sidebar-row-leave" : ""}`}
              >
                <EntryIcon
                  name={entry.name}
                  path={entry.path}
                  type={entry.type}
                  active={isActive}
                  muted
                />
                {/* min-w-0 musí být, jinak se flex položka odmítne zkrátit pod obsah. */}
                <span className="min-w-0 flex-1 truncate">{names.name(entry.name, entry.type === "folder")}</span>
                <span className="fw-sidebar-value">{formatRelative(entry.opened_at)}</span>
              </button>
            );
          })}
        </nav>
      </Collapsible>
    </div>
  );
}

/* --------------------------------- TAGY ----------------------------------- */

type TagsSectionProps = {
  counts: Map<TagColor, number>;
  activeTag: TagColor | null;
  windowFocused: boolean;
  onSelectTag: (color: TagColor) => void;
  onContextMenu: (color: TagColor, x: number, y: number) => void;
  heading: HeadingControl;
};

function TagsSection({
  counts,
  activeTag,
  windowFocused,
  onSelectTag,
  onContextMenu,
  heading,
}: TagsSectionProps) {
  const t = useT();
  // Jen barvy, které se opravdu používají — prázdná sekce se schová celá.
  const used = TAG_COLORS.filter((color) => (counts.get(color) ?? 0) > 0);
  if (used.length === 0) return null;

  return (
    <div className="fw-sidebar-section">
      <SectionHeading control={heading}>{t("sidebar.tags")}</SectionHeading>

      <Collapsible open={!heading.collapsed}>
        <nav className="flex flex-col pb-0.5">
          {used.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onSelectTag(color)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onContextMenu(color, event.clientX, event.clientY);
              }}
              className={`${ROW_CLASS} ${rowStateClass(activeTag === color, windowFocused)}`}
            >
              {/* Vnitřní světlý lem, ať puntík nepůsobí plochý. */}
              <span
                className="mx-[3px] shrink-0 rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: TAG_HEX[color],
                  boxShadow: "var(--dot-highlight)",
                }}
              />
              <span className="min-w-0 flex-1 truncate">{tagLabel(color)}</span>
              <span className="fw-sidebar-value">{counts.get(color)}</span>
            </button>
          ))}
        </nav>
      </Collapsible>
    </div>
  );
}

/* -------------------------------- sidebar --------------------------------- */

type SidebarMenu =
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

export function Sidebar({
  sections,
  currentPath,
  windowFocused,
  onNavigate,
  onOpenTab,
  onOpenFile,
  onReveal,
  activeTag,
  onSelectTag,
  trashActive,
  trashCount,
  onOpenTrash,
  onOpenTrashTab,
  onDropInto,
  onError,
  onConfirm,
  showHidden,
  tabId,
}: SidebarProps) {
  const t = useT();
  const drag = useDrag();

  // MI-FORK: árbol de carpetas.
  tree.useFolderTree();
  useEffect(() => tree.setTreeShowHidden(showHidden), [showHidden]);
  useEffect(() => tree.setTreeTab(tabId), [tabId]);
  /** Raíces del árbol: carpetas de las secciones del backend (no teléfonos). */
  const treeRoots = useMemo(
    () => sections.flatMap((section) => section.items.filter((item) => !item.external).map((item) => item.path)),
    [sections],
  );
  // MI-FORK: dona de ocupación — solo unidades con letra (no teléfonos ni nube).
  const drivePaths = useMemo(
    () =>
      sections
        .filter((section) => section.id === "devices")
        .flatMap((section) => section.items.filter((item) => item.letter !== null && !item.external))
        .map((item) => item.path),
    [sections],
  );
  const driveUsage = useDriveUsage(drivePaths);
  // El árbol sigue a la carpeta actual: bajo la raíz más profunda que la
  // contiene se abren los antepasados, pero solo si esa raíz ya está desplegada.
  useEffect(() => {
    if (currentPath === null || !tree.TREE_ENABLED) return;
    // Lo que muestra la carpeta actual en el árbol se refresca al entrar en ella.
    tree.refreshLoaded([currentPath]);
    const key = storage.pathKey(currentPath);
    let best: string | null = null;
    // La carpeta ya es una raíz (Escritorio, C:\): su fila basta, no se despliega otra.
    if (treeRoots.some((root) => storage.pathKey(root) === key)) return;
    for (const root of treeRoots) {
      const rootKey = storage.pathKey(root);
      const inside = key.startsWith(rootKey.endsWith("\\") ? rootKey : `${rootKey}\\`);
      if (!inside || !tree.isExpanded(root)) continue;
      if (key !== rootKey && (best === null || rootKey.length > storage.pathKey(best).length)) best = root;
    }
    if (best !== null) tree.revealPath(best, currentPath);
  }, [currentPath, treeRoots]);
  // Cambios en disco (el watcher vigila la carpeta actual).
  useEffect(() => {
    if (currentPath === null || !tree.TREE_ENABLED) return;
    const unlisten = listen("dir-changed", () => tree.refreshLoaded([currentPath]));
    return () => void unlisten.then((stop) => stop());
  }, [currentPath]);
  /** Coloca de nuevo la placa de selección (el árbol pinta filas al hacer scroll). */
  const placeIndicatorsRef = useRef<() => void>(() => undefined);

  /** Složka v sidebaru, nad kterou visí tažení (rámeček jako ve výpisu). */
  const [dropPath, setDropPath] = useState<string | null>(null);
  useEffect(() => {
    if (drag === null) setDropPath(null);
  }, [drag]);

  /** Řádek složky jako cíl: položky z výpisu i soubory z Průzkumníku —
   *  přesun, s Ctrl kopie. */
  function folderDropProps(path: string) {
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!isExternalFileDrag(event) && !canDropInto(path, getDrag())) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = event.ctrlKey ? "copy" : "move";
        setDropPath(path);
      },
      onDragLeave: (event: React.DragEvent) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropPath((current) => (current === path ? null : current));
      },
      onDrop: (event: React.DragEvent) => {
        setDropPath(null);
        const copy = event.ctrlKey;
        if (isExternalFileDrag(event)) {
          event.preventDefault();
          void droppedPaths(event.dataTransfer).then((paths) => {
            if (paths.length > 0) onDropInto(path, paths, copy);
          });
          return;
        }
        const payload = getDrag();
        if (payload?.kind !== "entry" || !canDropInto(path, payload)) return;
        event.preventDefault();
        endDrag();
        onDropInto(path, payload.items.map((item) => item.path), copy);
      },
    };
  }
  const { favorites, recents, tags, sidebarWidth } = useStorage();
  // Odebíraný nedávný řádek se nejdřív sbalí, teprve pak zmizí ze storage.
  const [leavingRecent, setLeavingRecent] = useState<string | null>(null);
  function removeRecentAnimated(path: string) {
    setLeavingRecent(path);
    window.setTimeout(() => {
      void storage.removeRecent(path).finally(() => setLeavingRecent(null));
    }, 180);
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  function confirmClearRecents() {
    onConfirm({
      title: t("confirm.clearRecentsTitle"),
      message: t("confirm.clearRecentsMessage"),
      confirmLabel: t("confirm.clearRecentsConfirm"),
      danger: true,
      onConfirm: () => void storage.clearRecents(),
    });
  }

  function confirmRemoveTag(color: TagColor) {
    const count = Object.values(tags).filter((colors) => colors.includes(color)).length;
    onConfirm({
      title: t("confirm.removeTagTitle", { tag: tagLabel(color).toLowerCase() }),
      message: t("confirm.removeTagMessage", { count }),
      confirmLabel: t("confirm.removeTagConfirm"),
      danger: true,
      onConfirm: () => void storage.removeTagEverywhere(color),
    });
  }

  function openDeviceOrReport(path: string) {
    openDevice(path).catch((err: unknown) => onError(failure("op.device", err)));
  }

  const [menu, setMenu] = useState<SidebarMenu | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  // MI-FORK: secciones propias; la recién creada entra directamente en edición del nombre.
  const groups = sidebarGroups.useSidebarGroups();
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  function createGroup() {
    void sidebarGroups.addGroup(t("sidebar.newSectionName")).then(setRenamingGroup);
  }
  const [pathTip, setPathTip] = useState<{ x: number; y: number; path: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);

  function toggleSection(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeCollapsed(next);
      return next;
    });
  }

  function headingFor(id: string): HeadingControl {
    return {
      collapsed: collapsed.has(id),
      onToggle: () => toggleSection(id),
      onContextMenu: (x, y) => setMenu({ kind: "heading", id, x, y }),
    };
  }

  const tagCounts = useMemo(() => {
    const counts = new Map<TagColor, number>();
    for (const colors of Object.values(tags)) {
      for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    return counts;
  }, [tags]);

  // Bublina s cestou zmizí sama, ať po ní uživatel nemusí klikat.
  useEffect(() => {
    if (pathTip === null) return;
    const timer = window.setTimeout(() => setPathTip(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pathTip]);

  function activateRecent(entry: RecentEntry) {
    if (entry.type === "folder") onNavigate(entry.path);
    else onOpenFile(entry.path, entry.name);
  }

  function activateFavorite(item: CustomFavorite) {
    if (item.type === "folder") onNavigate(item.path);
    // Popisek je uživatelův ("Smlouva"), do nedávných patří skutečný název
    // souboru — a ikona se odvozuje z jeho přípony.
    else onOpenFile(item.path, storage.lastSegment(item.path));
  }

  const menuItems = useMemo((): MenuItem[] => {
    if (menu === null) return [];

    const reveal = (path: string): MenuItem => ({
      type: "item",
      label: t("menu.openInExplorer"),
      onSelect: () => {
        openInExplorer(path).catch((err: unknown) => onError(failure("op.explorer", err)));
      },
    });

    const terminal = (path: string): MenuItem => ({
      type: "item",
      label: t("menu.openInTerminal"),
      onSelect: () => {
        openTerminal(path).catch((err: unknown) => onError(failure("op.terminal", err)));
      },
    });

    // MI-FORK: «Abrir con…» también para archivos en Acceso rápido y Recientes.
    const openWithItem = (path: string): MenuItem => ({
      type: "item",
      label: t("menu.openWith"),
      onSelect: () => {
        openWith(path).catch((err: unknown) => onError(failure("op.openWith", err)));
      },
    });

    const copyPathItem = (path: string): MenuItem => ({
      type: "item",
      label: t("menu.copyPath"),
      onSelect: () => {
        writeText(path).catch((err: unknown) => onError(failure("op.copyPath", err)));
      },
    });

    const showPath = (path: string): MenuItem => ({
      type: "item",
      label: t("menu.showPath"),
      onSelect: () => setPathTip({ x: menu.x, y: menu.y, path }),
    });

    const isFavorite = (path: string): boolean =>
      favorites.some((favorite) => storage.samePath(favorite.path, path));

    /** Přepínač "Přidat / Odebrat z oblíbených" — stejný text i chování všude. */
    const toggleFavorite = (path: string, label: string, kind: RecentKind): MenuItem => {
      const present = isFavorite(path);

      return {
        type: "item",
        label: present ? t("menu.removeFromFavorites") : t("menu.addToFavorites"),
        onSelect: () => {
          if (present) void storage.removeFavorite(path);
          else void storage.addFavorite({ label, path, icon: "Folder", type: kind });
        },
      };
    };

    if (menu.kind === "heading") {
      const { id } = menu;
      const isCollapsed = collapsed.has(id);
      const items: MenuItem[] = [
        {
          type: "item",
          label: isCollapsed ? t("menu.expandSection") : t("menu.collapseSection"),
          onSelect: () => toggleSection(id),
        },
      ];

      if (id === RECENTS_ID) {
        items.push(
          { type: "separator" },
          {
            type: "item",
            label: t("menu.clearRecents"),
            disabled: recents.length === 0,
            danger: true,
            onSelect: confirmClearRecents,
          },
        );
      }

      // MI-FORK: «Acceso rápido» y las secciones propias — crear, renombrar, mover, eliminar.
      if (id === CUSTOM_ID || id.startsWith(GROUP_PREFIX)) {
        items.push({ type: "separator" }, { type: "item", label: t("menu.newSection"), onSelect: createGroup });
      }
      if (id.startsWith(GROUP_PREFIX)) {
        const groupId = id.slice(GROUP_PREFIX.length);
        const at = groups.findIndex((group) => group.id === groupId);
        items.push(
          { type: "item", label: t("menu.renameSection"), onSelect: () => setRenamingGroup(groupId) },
          {
            type: "item",
            label: t("menu.sectionUp"),
            disabled: at <= 0,
            onSelect: () => void sidebarGroups.shiftGroup(groupId, -1),
          },
          {
            type: "item",
            label: t("menu.sectionDown"),
            disabled: at < 0 || at >= groups.length - 1,
            onSelect: () => void sidebarGroups.shiftGroup(groupId, 1),
          },
          { type: "separator" },
          {
            type: "item",
            label: t("menu.removeSection"),
            danger: true,
            onSelect: () => void sidebarGroups.removeGroup(groupId),
          },
        );
      }

      return items;
    }

    // Prázdné stavy a plocha pod poslední sekcí. Bez tohohle
    // tam pravý klik neudělal vůbec nic — menu webview je globálně potlačené.
    if (menu.kind === "background") {
      const canAdd = currentPath !== null && !isFavorite(currentPath);

      return [
        {
          type: "item",
          label: canAdd ? t("menu.addCurrentToFavorites") : t("menu.currentAlreadyFavorite"),
          disabled: !canAdd,
          onSelect: () => {
            if (currentPath === null) return;
            void storage.addFavorite({
              label: storage.lastSegment(currentPath),
              path: currentPath,
              icon: "Folder",
              type: "folder",
            });
          },
        },
        { type: "item", label: t("menu.newSection"), onSelect: createGroup }, // MI-FORK
        { type: "separator" },
        {
          type: "item",
          label: t("menu.clearAllRecents"),
          disabled: recents.length === 0,
          danger: true,
          onSelect: confirmClearRecents,
        },
      ];
    }

    if (menu.kind === "tag") {
      const { color } = menu;

      return [
        { type: "item", label: t("menu.open"), onSelect: () => onSelectTag(color) },
        { type: "separator" },
        {
          type: "item",
          label: t("menu.removeTagEverywhere", { tag: tagLabel(color).toLowerCase() }),
          danger: true,
          onSelect: () => confirmRemoveTag(color),
        },
      ];
    }

    // Sekce od backendu se nedají přejmenovat ani odebrat — nejsou naše. Zbytek
    // nabídky ale smí být stejný jako u vlastních oblíbených; bez toho na nich
    // pravý klik vytáhl menu webview.
    // MI-FORK: acciones del árbol, en filas del árbol y en sus raíces.
    const treeItems = (path: string | null): MenuItem[] => [
      { type: "separator" },
      ...(path === null
        ? []
        : [
            {
              type: "item" as const,
              label: t("tree.expandAll"),
              shortcut: "*",
              onSelect: () => void tree.expandSubtree(path),
            },
          ]),
      { type: "item", label: t("tree.collapseAll"), onSelect: () => tree.collapseAll() },
      {
        type: "item",
        label: t("tree.showFiles"),
        checked: tree.treeShowsFiles(),
        onSelect: () => tree.setTreeShowFiles(!tree.treeShowsFiles()),
      },
    ];

    if (menu.kind === "tree") {
      const { entry } = menu;

      if (!entry.is_dir) {
        return [
          { type: "item", label: t("menu.open"), onSelect: () => onOpenFile(entry.path, entry.name) },
          openWithItem(entry.path),
          { type: "item", label: t("menu.showInFolder"), onSelect: () => onReveal(entry.path) },
          reveal(entry.path),
          copyPathItem(entry.path),
          { type: "separator" },
          toggleFavorite(entry.path, entry.name, "file"),
          ...treeItems(null),
        ];
      }

      return [
        { type: "item", label: t("menu.open"), onSelect: () => onNavigate(entry.path) },
        { type: "item", label: t("menu.openInNewTab"), onSelect: () => onOpenTab(entry.path) },
        { type: "separator" },
        reveal(entry.path),
        terminal(entry.path),
        { type: "separator" },
        toggleFavorite(entry.path, entry.name, "folder"),
        copyPathItem(entry.path),
        ...treeItems(entry.path),
      ];
    }

    if (menu.kind === "section") {
      const { item } = menu;

      // Telefon nemá cestu, se kterou by šlo cokoli dalšího dělat.
      if (item.external) {
        return [
          {
            type: "item",
            label: t("menu.openInExplorer"),
            onSelect: () => openDeviceOrReport(item.path),
          },
        ];
      }

      return [
        { type: "item", label: t("menu.open"), onSelect: () => onNavigate(item.path) },
        { type: "separator" },
        reveal(item.path),
        terminal(item.path),
        { type: "separator" },
        toggleFavorite(item.path, sidebarLabel(item), "folder"),
        copyPathItem(item.path),
        showPath(item.path),
        ...(tree.TREE_ENABLED ? treeItems(item.path) : []), // MI-FORK
      ];
    }

    if (menu.kind === "favorite") {
      const { item } = menu;
      // MI-FORK: «Mover a ▸» — las demás secciones (y una nueva al final).
      const here = sidebarGroups.groupOf(item, groups);
      const targets = [
        { id: undefined as string | undefined, name: t("sidebar.custom") },
        ...groups.map((group) => ({ id: group.id as string | undefined, name: group.name })),
      ].filter((target) => target.id !== here);
      const moveTo: MenuItem = {
        type: "submenu",
        label: t("menu.moveToSection"),
        items: [
          ...targets.map((target) => ({
            type: "item" as const,
            label: target.name,
            onSelect: () => void sidebarGroups.moveFavoriteTo(item.path, target.id, Number.MAX_SAFE_INTEGER),
          })),
          ...(targets.length > 0 ? [{ type: "separator" as const }] : []),
          {
            type: "item" as const,
            label: t("menu.newSection"),
            onSelect: () => {
              void sidebarGroups.addGroup(t("sidebar.newSectionName")).then(async (id) => {
                await sidebarGroups.moveFavoriteTo(item.path, id, 0);
                setRenamingGroup(id);
              });
            },
          },
        ],
      };

      return [
        { type: "item", label: t("menu.open"), onSelect: () => activateFavorite(item) },
        ...(item.type === "file" ? [openWithItem(item.path)] : []), // MI-FORK
        { type: "separator" },
        {
          type: "item",
          label: t("menu.rename"),
          onSelect: () => setRenamingPath(item.path),
        },
        moveTo,
        {
          type: "item",
          label: t("menu.removeFromFavorites"),
          danger: true,
          onSelect: () => void storage.removeFavorite(item.path),
        },
        { type: "separator" },
        reveal(item.path),
        {
          type: "item",
          label: t("menu.showInFolder"),
          // U kořene disku není kam odkrývat.
          disabled: parentPath(item.path) === null,
          onSelect: () => onReveal(item.path),
        },
        // U souboru by terminál otevřel jeho složku — matoucí, radši ho vynech.
        ...(item.type === "folder" ? [terminal(item.path)] : []),
        copyPathItem(item.path),
        showPath(item.path),
      ];
    }

    const { entry } = menu;

    return [
      { type: "item", label: t("menu.open"), onSelect: () => activateRecent(entry) },
      ...(entry.type === "file" ? [openWithItem(entry.path)] : []), // MI-FORK
      reveal(entry.path),
      {
        type: "item",
        label: t("menu.showInFolder"),
        // U kořene disku není kam odkrývat.
        disabled: parentPath(entry.path) === null,
        onSelect: () => onReveal(entry.path),
      },
      copyPathItem(entry.path),
      { type: "separator" },
      toggleFavorite(entry.path, entry.name, entry.type),
      {
        type: "item",
        label: t("menu.removeFromRecents"),
        onSelect: () => removeRecentAnimated(entry.path),
      },
      {
        type: "item",
        label: t("menu.clearAllRecents"),
        danger: true,
        onSelect: confirmClearRecents,
      },
    ];
    // toggleSection jen zapisuje do stavu, jeho identita na výsledek nemá vliv.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    menu,
    favorites,
    groups, // MI-FORK
    recents,
    collapsed,
    currentPath,
    onNavigate,
    onOpenTab,
    onReveal,
    onOpenFile,
    onSelectTag,
    onError,
    onConfirm,
    tags,
    t,
  ]);

  /** Sekce od backendu jako řádky — Oblíbené, Cloud, Zařízení. */
  function renderSystemSection(section: FavoriteSection) {
    const heading = headingFor(`system:${section.id}`);

    return (
      <div key={section.id}>
        <SectionHeading control={heading}>{t(SECTION_TITLES[section.id])}</SectionHeading>

        <Collapsible open={!heading.collapsed}>
          <nav className="flex flex-col pb-0.5">
            {section.items.map((item) => {
              const Icon = sidebarIcon(item.icon_name);
              const isActive =
                !item.external && highlightPath !== null && storage.samePath(item.path, highlightPath);
              const usage = section.id === "devices" ? driveUsage(item.path) : undefined;

              return (
                <div key={`${section.id}/${item.path}`} className="contents">
                  <button
                    type="button"
                    // Shellová cesta telefonu ("::{20D04FE0…}\\?\usb#…") nikomu nic neřekne.
                    data-tooltip={
                      item.external
                        ? t("sidebar.opensInExplorer")
                        : usage
                          ? `${item.path}\n${driveUsageText(usage, t)}`
                          : item.path
                    }
                    onClick={() => {
                      if (item.external) openDeviceOrReport(item.path);
                      else onNavigate(item.path);
                    }}
                    {...(item.external ? {} : folderDropProps(item.path))}
                    {...(item.external ? {} : placeDragProps(item.path, sidebarLabel(item)))}
                    // MI-FORK: botón central = pestaña nueva, como en Recientes.
                    onMouseDown={preventMiddleScroll}
                    onAuxClick={(event) => {
                      if (event.button === 1 && !item.external) onOpenTab(item.path);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setMenu({ kind: "section", item, x: event.clientX, y: event.clientY });
                    }}
                    // MI-FORK: raíz del árbol — doble clic y teclado como en el Explorador.
                    {...(!item.external && tree.TREE_ENABLED
                      ? {
                          "data-tree-path": item.path,
                          "aria-expanded": tree.isExpanded(item.path),
                          onDoubleClick: () => tree.toggleExpanded(item.path),
                          onKeyDown: (event: React.KeyboardEvent<HTMLElement>) =>
                            handleTreeKey(event, item.path, true),
                        }
                      : {})}
                    className={`group ${ROW_CLASS} ${rowStateClass(isActive, windowFocused)} ${
                      dropPath === item.path ? "fw-drop-target" : ""
                    }`}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className="fw-sidebar-icon shrink-0"
                      color={iconColor(sidebarIconColor(section.id), isActive)}
                    />
                    <span className="truncate">{sidebarLabel(item)}</span>
                    {!item.external && (
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        <GitBadge path={item.path} isDir className="" />
                        {usage && <DriveDonut usage={usage} />}
                        {/* Flecha a la derecha y solo al pasar el ratón (como en los
                            títulos de sección), así las raíces no se desalinean. */}
                        {tree.TREE_ENABLED && (
                          <TreeToggle path={item.path} className="fw-tree-root-toggle -mr-1" />
                        )}
                      </span>
                    )}
                  </button>
                  {/* Montado también contraído: así la raíz anima al cerrarse. */}
                  {tree.TREE_ENABLED && !item.external && (
                    <FolderTree
                      root={item.path}
                      rows={tree.flatten(item.path)}
                      highlightPath={highlightPath}
                      scrollRef={asideRef}
                      rowClass={(active, drop) =>
                        `${ROW_CLASS} ${rowStateClass(active, windowFocused)} ${drop ? "fw-drop-target" : ""}`
                      }
                      dropPath={dropPath}
                      dropProps={folderDropProps}
                      onNavigate={onNavigate}
                      onOpenTab={onOpenTab}
                      onOpenFile={onOpenFile}
                      onReveal={onReveal}
                      onContextMenu={(entry, x, y) => setMenu({ kind: "tree", entry, x, y })}
                      onLayout={() => placeIndicatorsRef.current()}
                    />
                  )}
                </div>
              );
            })}
            {section.id === "devices" && (
              <button
                type="button"
                data-tooltip={trashCount > 0 ? t("sidebar.trashFull", { count: trashCount }) : t("sidebar.trash")}
                onClick={onOpenTrash}
                onMouseDown={preventMiddleScroll}
                onAuxClick={(event) => {
                  if (event.button === 1) onOpenTrashTab();
                }}
                className={`${ROW_CLASS} ${rowStateClass(trashActive, windowFocused)}`}
              >
                {/* Plný Koš = vyplněná nádoba (jako ikona Koše ve Windows). */}
                <Trash2
                  size={16}
                  strokeWidth={1.75}
                  className="fw-sidebar-icon shrink-0"
                  color={iconColor(sidebarIconColor(section.id), trashActive)}
                  fill={trashCount > 0 ? iconColor(sidebarIconColor(section.id), trashActive) : "none"}
                  fillOpacity={trashCount > 0 ? 0.3 : undefined}
                  aria-hidden
                />
                <span className="truncate">{t("sidebar.trash")}</span>
              </button>
            )}
          </nav>
        </Collapsible>
      </div>
    );
  }

  // Pořadí jako v Průzkumníku: Rychlý přístup (připnuté), Tento počítač
  // (známé složky), Cloud, Disky (s Košem), pak Nedávné a Štítky.
  const favoritesSection = sections.find((section) => section.id === "favorites");
  const otherSections = sections.filter((section) => section !== favoritesSection);

  /**
   * Tažení za pravou hranu mění šířku. Během tažení se sahá jen na styl panelu
   * (jednou za snímek) — přes úložiště by každý pohyb myši překreslil celou
   * aplikaci. Do nastavení (a do Reactu) se šířka zapíše až na konci.
   */
  function startResize(event: React.MouseEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const panel = panelRef.current;
    const aside = asideRef.current;
    let width = startWidth;
    let frame = 0;

    const clamp = (value: number) =>
      Math.round(Math.min(storage.SIDEBAR_MAX, Math.max(storage.SIDEBAR_MIN, value)));
    const onMove = (move: MouseEvent) => {
      width = clamp(startWidth + move.clientX - startX);
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (panel) panel.style.width = `${width}px`;
        if (aside) aside.dataset.wide = String(width > 240);
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(frame);
      document.body.style.cursor = "";
      document.documentElement.classList.remove("is-resizing-sidebar");
      void storage.setSidebarWidth(width);
    };
    document.body.style.cursor = "col-resize";
    document.documentElement.classList.add("is-resizing-sidebar");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // V Koši se složka, ze které uživatel přišel, nezvýrazňuje.
  const highlightPath = trashActive ? null : currentPath;

  // MI-FORK: lo común a «Acceso rápido» y a las secciones propias.
  const favoriteProps = {
    currentPath: highlightPath,
    windowFocused,
    onActivate: activateFavorite,
    onContextMenu: (item: CustomFavorite, x: number, y: number) => setMenu({ kind: "favorite", item, x, y }),
    renamingPath,
    onRenameSubmit: (path: string, label: string) => {
      setRenamingPath(null);
      void storage.renameFavorite(path, label);
    },
    onRenameCancel: () => setRenamingPath(null),
    onOpenTab,
  };

  // Výběr jako deska, která mezi řádky sjíždí nahoru/dolů. Stejná složka může
  // být ve více sekcích (Rychlý přístup i Tento počítač) — pak má desku každý
  // aktivní řádek; první sjíždí, další se objeví na místě. Měří se po každém
  // renderu (aktivní řádek, sbalení sekce) a při změně velikosti.
  const indicatorsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const aside = asideRef.current;
    const layer = indicatorsRef.current;
    if (!aside || !layer) return;
    const place = () => {
      const rows = aside.querySelectorAll<HTMLElement>(
        ".fw-collapse:not([data-collapsed='true']) .fw-sidebar-row:is(.is-active, .is-active-dim)",
      );
      while (layer.children.length < rows.length) {
        const plate = document.createElement("div");
        plate.className = "fw-sidebar-indicator";
        plate.dataset.visible = "false";
        layer.append(plate);
      }
      const box = aside.getBoundingClientRect();
      Array.from(layer.children as HTMLCollectionOf<HTMLElement>).forEach((indicator, index) => {
        const row = rows[index];
        if (!row) {
          indicator.dataset.visible = "false";
          return;
        }
        const rect = row.getBoundingClientRect();
        const first = indicator.dataset.visible !== "true";
        if (first) indicator.style.transition = "none";
        indicator.style.transform = `translateY(${rect.top - box.top + aside.scrollTop}px)`;
        indicator.style.left = `${rect.left - box.left}px`;
        indicator.style.width = `${rect.width}px`;
        indicator.style.height = `${rect.height}px`;
        indicator.dataset.dim = String(row.classList.contains("is-active-dim"));
        indicator.dataset.visible = "true";
        if (first) {
          void indicator.offsetWidth;
          indicator.style.transition = "";
        }
      });
    };
    place();
    placeIndicatorsRef.current = place; // MI-FORK
    const observer = new ResizeObserver(place);
    observer.observe(aside);
    // Během sbalování sekce nad výběrem se řádek posouvá — deska jde s ním.
    aside.querySelectorAll(".fw-collapse").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });

  return (
    <div ref={panelRef} className="fw-sidebar-box relative flex shrink-0" style={{ width: sidebarWidth }}>
      <aside
        ref={asideRef}
        // Menu volné plochy visí na celém sloupci: nadpisy sekcí, prázdné stavy
        // i prostor pod poslední sekcí patří jemu. Řádky si událost zastaví samy.
        onContextMenu={(event) => {
          if (isTypingTarget(event.target)) return;
          event.preventDefault();
          setMenu({ kind: "background", x: event.clientX, y: event.clientY });
        }}
        // Hodnoty vpravo (čas, počty) jsou u úzkého panelu vidět jen při najetí.
        data-wide={sidebarWidth > 240}
        className="fw-sidebar fw-scroll relative isolate flex w-full flex-col overflow-y-auto pt-1"
      >
        {/* display: contents — desky se umisťují vůči <aside>. */}
        <div ref={indicatorsRef} className="contents" aria-hidden="true" />
        {/* MI-FORK: «Acceso rápido» y después cada sección propia, con los mismos favoritos repartidos. */}
        <CustomFavorites
          {...favoriteProps}
          items={favorites.filter((item) => sidebarGroups.groupOf(item, groups) === undefined)}
          group={undefined}
          title={t("sidebar.custom")}
          heading={headingFor(CUSTOM_ID)}
        />
        {groups.map((group) => (
          <CustomFavorites
            key={group.id}
            {...favoriteProps}
            items={favorites.filter((item) => sidebarGroups.groupOf(item, groups) === group.id)}
            group={group.id}
            alwaysVisible
            title={
              renamingGroup === group.id ? (
                <LabelInput
                  initial={group.name}
                  onSubmit={(name) => {
                    setRenamingGroup(null);
                    void sidebarGroups.renameGroup(group.id, name);
                  }}
                  onCancel={() => setRenamingGroup(null)}
                />
              ) : (
                group.name
              )
            }
            heading={headingFor(`${GROUP_PREFIX}${group.id}`)}
          />
        ))}

        {favoritesSection && renderSystemSection(favoritesSection)}

        {otherSections.map(renderSystemSection)}

        <Recents
          items={recents}
          leaving={leavingRecent}
          onOpenTab={onOpenTab}
          currentPath={highlightPath}
          windowFocused={windowFocused}
          onActivate={activateRecent}
          onContextMenu={(entry, x, y) => setMenu({ kind: "recent", entry, x, y })}
          heading={headingFor(RECENTS_ID)}
        />

        <TagsSection
          counts={tagCounts}
          activeTag={activeTag}
          windowFocused={windowFocused}
          onSelectTag={onSelectTag}
          onContextMenu={(color, x, y) => setMenu({ kind: "tag", color, x, y })}
          heading={headingFor(TAGS_ID)}
        />

        {/* Roztáhne se přes zbytek sloupce, aby pravý klik dole padl do sidebaru
            a ne mimo něj. */}
        <div className="min-h-[8px] flex-1 shrink-0" />

        {menu && (
          <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
        )}

        {pathTip && (
          <div
            className="fw-popover fixed z-50 max-w-[320px] rounded-md px-2.5 py-1.5 font-mono text-[11px] break-all text-primary"
            style={{
              left: Math.min(pathTip.x, window.innerWidth - 340),
              top: pathTip.y + 6,
            }}
          >
            {pathTip.path}
          </div>
        )}
      </aside>

      {/* Táhlo šířky na pravé hraně; dvojklik vrátí výchozích 220 px. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("sidebar.resize")}
        onMouseDown={startResize}
        onDoubleClick={() => void storage.setSidebarWidth(storage.SIDEBAR_DEFAULT)}
        className="fw-sidebar-resizer"
      />
    </div>
  );
}
