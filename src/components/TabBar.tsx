import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { folderDisplayName } from "./icons";
import type { Command } from "../commands";
import { useT } from "../i18n";
import { canDropInto, droppedPaths, endDrag, getDrag, isExternalFileDrag } from "../lib/dnd";
import type { DropInto } from "../lib/rowDnd";
import { breadcrumbs } from "../format";

export type TabItem = {
  id: number;
  path: string | null;
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
};

/** Typ dat taženého ouška — odliší ho od tažení souborů. */
const TAB_MIME = "application/x-finder-win-tab";

/** Popisek záložky: přeložený název složky jako v záhlaví toolbaru. */
function tabTitle(path: string | null): string {
  if (path === null) return "File Manager"; // MI-FORK
  const crumbs = breadcrumbs(path);
  const last = crumbs[crumbs.length - 1];
  return last ? folderDisplayName(last.path, last.label) : path;
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
}: TabBarProps) {
  const t = useT();
  /** Ouško, které se právě táhne (přerovnání). */
  const dragging = useRef<number | null>(null);
  /** Záložka, nad kterou visí tažený soubor. */
  const [dropId, setDropId] = useState<number | null>(null);
  const open = tabs.filter((tab) => !tab.closing).length;

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
    <div className={`fw-tabbar ${open <= 1 ? "is-single" : ""}`}>
      <div ref={trackRef} className="fw-tab-track" role="tablist" aria-label={t("tabs.label")}>
        {pill !== null && (
          <span
            aria-hidden
            className={`fw-tab-pill ${pillReady ? "is-ready" : ""}`}
            style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
          />
        )}
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          const title = tabTitle(tab.path);

          const acceptsDrop = (event: React.DragEvent) =>
            tab.path !== null && (isExternalFileDrag(event) || canDropInto(tab.path, getDrag()));

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              data-tooltip={tab.path ?? undefined}
              draggable={!tab.closing}
              className={`fw-tab ${isActive ? "is-active" : ""} ${windowFocused ? "" : "is-blurred"} ${
                tab.fresh ? "fw-tab-in" : ""
              } ${tab.closing ? "fw-tab-out" : ""} ${dropId === tab.id ? "fw-drop-target" : ""}`}
              onMouseDown={(event) => {
                // Prostřední tlačítko zavírá (a nesmí spustit automatické posouvání).
                if (event.button === 1) event.preventDefault();
              }}
              onClick={() => onSelect(tab.id)}
              onAuxClick={(event) => {
                if (event.button === 1) onClose(tab.id);
              }}
              onDragStart={(event) => {
                dragging.current = tab.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(TAB_MIME, String(tab.id));
              }}
              onDragEnd={() => {
                dragging.current = null;
              }}
              onDragOver={(event) => {
                const moving = dragging.current;
                if (moving !== null) {
                  // Přerovnání naživo, jako v prohlížeči: ouško uhne hned.
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (moving !== tab.id) onReorder(moving, index);
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
              <span className="fw-tab-title truncate">{title}</span>
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
