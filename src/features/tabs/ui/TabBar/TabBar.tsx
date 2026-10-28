import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns2, Plus, X } from "lucide-react";

import { FolderIcon, folderDisplayName } from "../../../../shared/ui/icons";
import { specialFolderGlyph } from "../../../sidebar/domain/specialFolders";
import type { Command } from "../../../command-palette/domain/commands";
import { useT } from "../../../../shared/i18n/index";
import { canDropInto, droppedPaths, EMPTY_DRAG_IMAGE, endDrag, getDrag, isExternalFileDrag } from "../../../file-list/application/dnd";
import type { DropInto } from "../../../file-list/application/rowDnd";
import { breadcrumbs } from "../../../../shared/domain/format";
import { parentPath } from "../../../../shared/infrastructure/fileops";
import { motionMs } from "../../../../shared/lib/motion";

export type TabItem = {
  id: number;
  path: string | null;
  /** MI-FORK: rozdělená záložka — složky levého a pravého panelu. */
  panes?: [string | null, string | null];
  /** Aktivní panel rozdělené záložky. */
  activePane?: 0 | 1;
  closing: boolean;
  /** Právě otevřená — vjede animací. */
  fresh: boolean;
};

type TabBarProps = {
  tabs: TabItem[];
  activeId: number;
  windowFocused: boolean;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  /** Přetažení záložky na místo jiného ouška — `index` je pozice v poli záložek. */
  onReorder: (id: number, index: number) => void;
  /** Položky (i soubory z Průzkumníku) puštěné na záložku — přesun do její složky. */
  onDropInto: DropInto;
  /** Příkaz Nová záložka z registru — + za posledním ouškem, totéž co Ctrl+T. */
  newTab: Command;
  /** MI-FORK: tažené ouško (null = konec tažení) — App podle něj ukáže zóny rozdělení nad panely. */
  onTabDrag?: (id: number | null) => void;
  /** MI-FORK: pravý klik na ouško — menu záložky. */
  onTabMenu?: (id: number, x: number, y: number) => void;
};

/** Typ dat taženého ouška — odliší ho od tažení souborů. */
export const TAB_MIME = "application/x-finder-win-tab";

/** Popisek záložky: přeložený název složky jako v záhlaví toolbaru. */
export function tabTitle(path: string | null): string {
  if (path === null) return "File Manager"; // MI-FORK
  const crumbs = breadcrumbs(path);
  const last = crumbs[crumbs.length - 1];
  return last ? folderDisplayName(last.path, last.label) : path;
}

/**
 * MI-FORK: názvy obou panelů rozdělené záložky. Stejně pojmenované složky
 * (dev a dev) se rozliší nadřazenou složkou: „dev · Michael“, „dev · C:“.
 */
function paneTitles([left, right]: [string | null, string | null]): [string, string] {
  const a = tabTitle(left);
  const b = tabTitle(right);
  if (a !== b || left === null || right === null || left === right) return [a, b];
  const parent = (path: string) => {
    const up = parentPath(path);
    return up === null ? "" : ` · ${tabTitle(up)}`;
  };
  return [a + parent(left), b + parent(right)];
}

/**
 * Lišta záložek pod toolbarem, vždy vidět. MI-FORK: segmentovaný ovladač —
 * šedá dráha přes celou šířku, záložky stejně široké s názvem uprostřed,
 * aktivní vystouplá (bílá se stínem), × vlevo při najetí, + vpravo za dráhou.
 * Ouška jdou přerovnat tažením a dá se na ně pustit soubor (přesun do složky
 * záložky, s Ctrl kopie).
 */
export function TabBar({
  tabs,
  activeId,
  windowFocused,
  onSelect,
  onClose,
  onReorder,
  onDropInto,
  newTab,
  onTabDrag,
  onTabMenu,
}: TabBarProps) {
  const t = useT();
  /** Ouško, které se právě táhne (přerovnání). */
  const dragging = useRef<number | null>(null);
  /** Totéž pro vykreslení (zvýraznění taženého ouška). */
  const [draggingId, setDraggingId] = useState<number | null>(null);
  /** Záložka, nad kterou visí tažený soubor. */
  const [dropId, setDropId] = useState<number | null>(null);
  const open = tabs.filter((tab) => !tab.closing).length;

  /**
   * MI-FORK: tažení ouška jako v prohlížeči. Nad lištou ouško jede přesně
   * s kurzorem (transform mimo React, z dragover); jakmile jeho střed přejde
   * přes polovinu sousedního slotu, pořadí se změní a ostatní ouška uhnou
   * animací (FLIP). Mimo lištu se ouško vrátí do svého slotu a kurzor
   * provází „duch“ — ikona složky s názvem. Nativní obrázek tažení je prázdný
   * (viz EMPTY_DRAG_IMAGE). Po puštění ouško do slotu dojede.
   */
  const barRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  /** Kurzor (poslední dragover) a kde ve oušku bylo chyceno. */
  const pointer = useRef({ x: 0, y: 0 });
  const grabOffset = useRef(0);
  /** Poloha oušek před posledním přerovnáním — pro FLIP. */
  const slotLefts = useRef(new Map<number, number>());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  /** Zvednuté ouško: během tažení a ještě chvíli, než dojede do slotu. */
  const [liftedId, setLiftedId] = useState<number | null>(null);
  const draggedTab = draggingId === null ? null : tabs.find((tab) => tab.id === draggingId) ?? null;

  const tabElement = (id: number) =>
    trackRef.current?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`) ?? null;

  /** Posune tažené ouško za kurzorem a případně přerovná. */
  const follow = () => {
    const id = dragging.current;
    const track = trackRef.current;
    const el = id === null ? null : tabElement(id);
    if (id === null || !track || !el) return;
    const { x, y } = pointer.current;
    const bar = barRef.current?.getBoundingClientRect();
    const overBar = bar !== undefined && y >= bar.top && y <= bar.bottom;

    const ghost = ghostRef.current;
    if (ghost) {
      ghost.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
      ghost.classList.toggle("is-shown", !overBar);
    }
    if (!overBar) {
      el.style.transition = "";
      el.style.transform = "";
      return;
    }

    const box = track.getBoundingClientRect();
    const width = el.offsetWidth;
    const inset = 2; // padding dráhy
    const left = Math.min(Math.max(x - box.left - grabOffset.current, inset), box.width - inset - width);
    el.style.transition = "none";
    el.style.transform = `translateX(${left - el.offsetLeft}px)`;

    // Ouška jsou stejně široká — slot = střed taženého ouška / šířka.
    const list = tabsRef.current;
    const from = list.findIndex((tab) => tab.id === id);
    const slot = Math.min(Math.max(Math.floor((left - inset + width / 2) / width), 0), list.length - 1);
    if (from >= 0 && slot !== from) onReorderRef.current(id, slot);
  };

  useLayoutEffect(() => {
    if (draggingId === null) return;
    const onDragOver = (event: DragEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      follow();
    };
    document.addEventListener("dragover", onDragOver, true);
    return () => document.removeEventListener("dragover", onDragOver, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  // Po přerovnání: ostatní ouška uhnou z původní polohy (FLIP), tažené se
  // hned přepočte k novému slotu, aby necuklo.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || dragging.current === null) return;
    for (const el of track.querySelectorAll<HTMLElement>("[data-tab-id]")) {
      const id = Number(el.dataset.tabId);
      const now = el.offsetLeft;
      const before = slotLefts.current.get(id);
      slotLefts.current.set(id, now);
      if (id === dragging.current || before === undefined || before === now) continue;
      el.style.transition = "none";
      el.style.transform = `translateX(${before - now}px)`;
      void el.offsetWidth;
      el.style.transition = "";
      el.style.transform = "";
    }
    follow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  /**
   * Výplň aktivní záložky je jediný prvek, který mezi záložkami klouže.
   * Poloha se měří z DOM; sleduje i změny šířky (otevření, zavření, okno).
   */
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  /** První umístění bez animace — jinak by výplň vyjela z levého okraje. */
  const [pillReady, setPillReady] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const active = track.querySelector<HTMLElement>(".fw-tab.is-active");
      setPill(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    for (const child of track.querySelectorAll(".fw-tab")) observer.observe(child);
    return () => observer.disconnect();
  }, [tabs, activeId]);

  useEffect(() => {
    if (pill === null || pillReady) return;
    const frame = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(frame);
  }, [pill, pillReady]);

  return (
    <div
      ref={barRef}
      className={`fw-tabbar ${open <= 1 ? "is-single" : ""}`}
      onDragOver={(event) => {
        // Mezery a + v liště: puštění ouška tu nesmí ukázat „zakázáno“.
        if (dragging.current === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (dragging.current !== null) event.preventDefault();
      }}
    >
      {draggedTab !== null &&
        createPortal(
          <div ref={ghostRef} className="mi-tab-ghost" aria-hidden>
            <div className="mi-tab-ghost-card">
              {draggedTab.path !== null && <FolderIcon size={32} glyph={specialFolderGlyph(draggedTab.path)} />}
              <span className="truncate">{tabTitle(draggedTab.path)}</span>
            </div>
          </div>,
          document.body,
        )}
      <div ref={trackRef} className="fw-tab-track" role="tablist" aria-label={t("tabs.label")}>
        {pill !== null && (
          <span
            aria-hidden
            className={`fw-tab-pill ${pillReady ? "is-ready" : ""} ${liftedId === activeId ? "is-hidden" : ""}`}
            style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
          />
        )}
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          const title = tabTitle(tab.path);

          const acceptsDrop = (event: React.DragEvent) =>
            tab.path !== null && (isExternalFileDrag(event) || canDropInto(tab.path, getDrag()));

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={isActive}
              data-tooltip={(tab.panes ? tab.panes.filter((p) => p !== null).join("\n") : tab.path) ?? undefined}
              draggable={!tab.closing}
              className={`fw-tab ${isActive ? "is-active" : ""} ${windowFocused ? "" : "is-blurred"} ${
                tab.fresh ? "fw-tab-in" : ""
              } ${tab.closing ? "fw-tab-out" : ""} ${dropId === tab.id ? "fw-drop-target" : ""} ${draggingId === tab.id ? "is-dragging" : ""} ${liftedId === tab.id ? "is-lifted" : ""}`}
              onMouseDown={(event) => {
                // Prostřední tlačítko zavírá (a nesmí spustit automatické posouvání).
                if (event.button === 1) event.preventDefault();
              }}
              onClick={() => onSelect(tab.id)}
              onContextMenu={(event) => {
                if (!onTabMenu || tab.closing) return;
                event.preventDefault();
                onTabMenu(tab.id, event.clientX, event.clientY);
              }}
              onAuxClick={(event) => {
                if (event.button === 1) onClose(tab.id);
              }}
              onDragStart={(event) => {
                dragging.current = tab.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(TAB_MIME, String(tab.id));
                event.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
                const rect = event.currentTarget.getBoundingClientRect();
                grabOffset.current = event.clientX - rect.left;
                pointer.current = { x: event.clientX, y: event.clientY };
                slotLefts.current = new Map(
                  [...(trackRef.current?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? [])].map((el) => [
                    Number(el.dataset.tabId),
                    el.offsetLeft,
                  ]),
                );
                setDraggingId(tab.id);
                setLiftedId(tab.id);
                onTabDrag?.(tab.id);
              }}
              onDragEnd={(event) => {
                dragging.current = null;
                setDraggingId(null);
                onTabDrag?.(null);
                // Dojede do slotu (přechod transform v .fw-tab), pak teprve zmizí zvednutí.
                const el = event.currentTarget;
                el.style.transition = "";
                el.style.transform = "";
                window.setTimeout(
                  () => setLiftedId((current) => (current === tab.id ? null : current)),
                  motionMs("--dur-nav") + 40,
                );
              }}
              onDragOver={(event) => {
                const moving = dragging.current;
                if (moving !== null) {
                  // Přerovnání řídí follow() podle polohy kurzoru.
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  return;
                }
                if (!acceptsDrop(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = event.ctrlKey ? "copy" : "move";
                setDropId(tab.id);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setDropId((current) => (current === tab.id ? null : current));
              }}
              onDrop={(event) => {
                setDropId(null);
                if (dragging.current !== null || tab.path === null) {
                  event.preventDefault();
                  return;
                }
                const folder = tab.path;
                const copy = event.ctrlKey;
                if (isExternalFileDrag(event)) {
                  event.preventDefault();
                  void droppedPaths(event.dataTransfer).then((paths) => {
                    if (paths.length > 0) onDropInto(folder, paths, copy);
                  });
                  return;
                }
                const payload = getDrag();
                if (payload?.kind !== "entry" || !canDropInto(folder, payload)) return;
                event.preventDefault();
                endDrag();
                onDropInto(
                  folder,
                  payload.items.map((item) => item.path),
                  copy,
                );
              }}
            >
              {tab.panes ? (
                <span className="fw-tab-title mi-tab-split">
                  <Columns2 size={12} strokeWidth={2} className="mi-tab-split-icon" aria-hidden />
                  {paneTitles(tab.panes).map((name, pane) => (
                    <Fragment key={pane}>
                      {pane === 1 && <span className="mi-tab-split-sep" aria-hidden />}
                      <span className={`mi-tab-split-name truncate ${tab.activePane === pane ? "is-current" : ""}`}>
                        {name}
                      </span>
                    </Fragment>
                  ))}
                </span>
              ) : (
                <span className="fw-tab-title truncate">{title}</span>
              )}
              <button
                type="button"
                className="fw-tab-close"
                aria-label={t("tabs.close")}
                data-tooltip={t("tabs.close")}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.id);
                }}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="fw-tab-new"
        aria-label={t("tabs.newWithShortcut")}
        data-tooltip={t("tabs.newWithShortcut")}
        disabled={!newTab.enabled}
        // Fokus zůstává ve výpisu (šipky), jako u tlačítek toolbaru.
        onMouseDown={(event) => event.preventDefault()}
        onClick={newTab.run}
      >
        <Plus size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
