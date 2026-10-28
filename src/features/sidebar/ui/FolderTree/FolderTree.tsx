import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { GitBadge } from "../../../git/ui/GitBadge";
import { SmallEntryIcon } from "../../../../shared/ui/icons";
import { parentPath } from "../../../../shared/application/fileops";
import { useT } from "../../../../shared/i18n/index";
import { useDisplayNames } from "../../../file-list/application/extensions";
import { canExpand, childrenOf, expandSubtree, isExpanded, revealedRecently, setExpanded, toggleExpanded, treeInMotion } from "../../application/folderTree";
import type { TreeRow } from "../../application/folderTree.types";
import { motionMs } from "../../../../shared/lib/motion";
import * as storage from "../../../../shared/infrastructure/storage";
import type { FolderTreeProps, Ghost } from "./FolderTree.types";
/*
 * MI-FORK: árbol de carpetas bajo las filas del sidebar (Acceso rápido, Este
 * equipo, discos). Estado y carga en lib/folderTree.ts.
 *
 * Las filas se virtualizan: el contenedor tiene la altura de todas y solo se
 * pintan las que caen en la parte visible del <aside> (más un margen).
 */

/** Igual que ROW_HEIGHT del sidebar (h-[24px]). */
const ROW = 24;
const OVERSCAN = 12;
/** Sangría por nivel; el primero queda bajo el icono de la raíz. */
const INDENT = 14;
/** Arrastrando encima de una carpeta cerrada, se abre tras este tiempo. */
const DRAG_OPEN_MS = 650;
/** Escalonado de la entrada de hijos (ms por fila, como mucho tantas filas). */
const STAGGER_MS = 14;
const STAGGER_ROWS = 12;
/** Cambios mayores (expandir con `*`, contraer node_modules) van sin deslizar. */
const MAX_ANIMATED_DELTA = 40;

/* ------------------------------- flecha ----------------------------------- */

/**
 * ▸ / ▾. Es un span y no un botón: va dentro del botón de la fila. El clic no
 * llega a la fila (no navega).
 */
export function TreeToggle({ path, className = "" }: { path: string; className?: string }) {
  const t = useT();
  const open = isExpanded(path);
  if (!canExpand(path)) return <span className={`inline-block w-3 shrink-0 ${className}`} />;
  const loading = open && childrenOf(path)?.status === "loading";

  return (
    <span
      role="button"
      aria-label={open ? t("tree.collapse") : t("tree.expand")}
      aria-expanded={open}
      onClick={(event) => {
        event.stopPropagation();
        toggleExpanded(path);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={`fw-tree-toggle inline-flex h-4 w-3 shrink-0 items-center justify-center text-secondary ${className}`}
      data-open={open}
    >
      <ChevronRight
        size={12}
        strokeWidth={2.25}
        className={`fw-t-reveal ${open ? "rotate-90" : ""} ${loading ? "opacity-50" : ""}`}
      />
    </span>
  );
}

/* ------------------------------- teclado ---------------------------------- */

function visibleRows(from: HTMLElement): HTMLElement[] {
  const aside = from.closest("aside");
  if (aside === null) return [];
  return Array.from(
    aside.querySelectorAll<HTMLElement>(".fw-collapse:not([data-collapsed='true']) [data-tree-path]"),
  );
}

function focusPath(from: HTMLElement, path: string) {
  const target = visibleRows(from).find((row) => storage.samePath(row.dataset.treePath ?? "", path));
  target?.focus();
}

/**
 * Teclas del Explorador: ↑/↓ mueven, → expande o entra, ← contrae o sube al
 * padre, `*` expande el subárbol, Inicio/Fin, Enter = clic.
 */
export function handleTreeKey(event: React.KeyboardEvent<HTMLElement>, path: string, isDir: boolean) {
  const row = event.currentTarget;
  const rows = () => visibleRows(row);
  const move = (delta: number) => {
    const list = rows();
    const index = list.indexOf(row);
    list[Math.min(list.length - 1, Math.max(0, index + delta))]?.focus();
  };

  switch (event.key) {
    case "ArrowDown":
      move(1);
      break;
    case "ArrowUp":
      move(-1);
      break;
    case "Home":
      rows()[0]?.focus();
      break;
    case "End": {
      const list = rows();
      list[list.length - 1]?.focus();
      break;
    }
    case "ArrowRight":
      if (!isDir) break;
      if (!isExpanded(path)) setExpanded(path, true);
      else move(1);
      break;
    case "ArrowLeft": {
      if (isDir && isExpanded(path)) {
        setExpanded(path, false);
        break;
      }
      // La raíz no tiene padre en el árbol (data-tree-root vacío).
      if (row.dataset.treeRoot === undefined) break;
      const parent = parentPath(path);
      if (parent !== null) focusPath(row, parent);
      break;
    }
    case "*":
      if (isDir) void expandSubtree(path);
      break;
    case "Enter":
      // Si no, lo coge el atajo global de App y abre la selección de la lista.
      row.click();
      break;
    default:
      return;
  }
  event.preventDefault();
  event.stopPropagation();
}

/* -------------------------------- ramas ----------------------------------- */

export function FolderTree({
  root,
  rows,
  highlightPath,
  scrollRef,
  rowClass,
  dropPath,
  dropProps,
  onNavigate,
  onOpenTab,
  onOpenFile,
  onReveal,
  onContextMenu,
  onLayout,
}: FolderTreeProps) {
  const names = useDisplayNames();
  const boxRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 60 });
  const dragTimer = useRef<{ path: string; id: number } | null>(null);

  // Rango visible: depende del scroll del <aside> y de dónde queda la rama.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const box = boxRef.current;
    if (!scroller || !box) return;
    const update = () => {
      const top = box.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      const start = Math.max(0, Math.floor(-top / ROW) - OVERSCAN);
      const end = Math.min(rows.length, Math.ceil((scroller.clientHeight - top) / ROW) + OVERSCAN);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    // Al plegar una sección de arriba la rama se mueve sin scroll.
    scroller.addEventListener("transitionend", update);
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      scroller.removeEventListener("transitionend", update);
      observer.disconnect();
    };
  }, [rows.length, scrollRef]);

  useLayoutEffect(() => {
    if (rows.length > 0 || prevRows.current.length > 0) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, rows]);

  // Sigue a la carpeta actual: al navegar, su fila se desplaza a la vista (una
  // vez — luego el usuario puede hacer scroll libremente).
  const follow = useRef<{ key: string | null; done: boolean }>({ key: null, done: false });
  useLayoutEffect(() => {
    const k = highlightPath === null ? null : storage.pathKey(highlightPath);
    if (follow.current.key !== k) follow.current = { key: k, done: false };
    if (k === null || follow.current.done) return;
    const index = rows.findIndex((row) => storage.pathKey(row.entry.path) === k);
    const scroller = scrollRef.current;
    const box = boxRef.current;
    if (index < 0 || !scroller || !box) return;
    follow.current.done = true;
    const top = box.getBoundingClientRect().top - scroller.getBoundingClientRect().top + index * ROW;
    if (top < 0) scroller.scrollTop += top - ROW;
    else if (top + ROW > scroller.clientHeight) scroller.scrollTop += top + 2 * ROW - scroller.clientHeight;
  }, [highlightPath, rows, scrollRef]);

  function clearDragTimer() {
    if (dragTimer.current !== null) window.clearTimeout(dragTimer.current.id);
    dragTimer.current = null;
  }

  // Animación: las filas que siguen se deslizan (top) y la caja cambia de
  // altura; solo tras una acción del usuario y si el cambio no es enorme.
  const prevRows = useRef<TreeRow[]>(rows);
  const delta = Math.abs(rows.length - prevRows.current.length);
  const motion = treeInMotion() && delta <= MAX_ANIMATED_DELTA;

  // Las filas que desaparecen (contraer) se desvanecen en su sitio.
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const ghostTimer = useRef(0);
  useLayoutEffect(() => {
    const prev = prevRows.current;
    prevRows.current = rows;
    if (!motion || prev.length <= rows.length) return;
    const present = new Set(rows.map((row) => storage.pathKey(row.entry.path)));
    const gone = prev.flatMap((row, index) =>
      index >= range.start && index < range.end && !present.has(storage.pathKey(row.entry.path))
        ? [{ ...row, index }]
        : [],
    );
    if (gone.length === 0) return;
    setGhosts(gone);
    window.clearTimeout(ghostTimer.current);
    ghostTimer.current = window.setTimeout(() => setGhosts([]), motionMs("--dur-slow"));
  });
  useLayoutEffect(() => () => window.clearTimeout(ghostTimer.current), []);

  // La caja nace con su altura final (raíz recién abierta): crece desde 0.
  const hadBox = useRef(false);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box !== null && !hadBox.current && motion) {
      box.animate([{ height: "0px" }, { height: `${rows.length * ROW}px` }], {
        duration: motionMs("--dur-zoom"),
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      });
    }
    hadBox.current = box !== null;
  });

  if (rows.length === 0 && ghosts.length === 0) return null;

  const visible = rows.slice(range.start, range.end);
  let entering = 0;

  return (
    <div
      ref={boxRef}
      role="group"
      className="fw-tree-box relative shrink-0"
      data-motion={motion ? "on" : "off"}
      style={{ height: rows.length * ROW }}
    >
      {ghosts.map(({ entry, depth, index }) => (
        <div
          key={`ghost:${entry.path}`}
          aria-hidden
          className={`${rowClass(false, false)} fw-tree-leave absolute inset-x-0`}
          style={{ top: index * ROW, gap: 6, paddingLeft: 8 + (depth - 1) * INDENT }}
        >
          <span className="inline-block w-3 shrink-0" />
          <SmallEntryIcon entry={entry} />
          <span className="truncate">{names.entry(entry)}</span>
        </div>
      ))}
      {visible.map(({ entry, depth }, offset) => {
        const index = range.start + offset;
        const active = highlightPath !== null && storage.samePath(entry.path, highlightPath);
        const drop = entry.is_dir ? dropProps(entry.path) : null;
        const parent = parentPath(entry.path);
        const enter = parent !== null && revealedRecently(parent);
        const delay = enter ? Math.min(entering++, STAGGER_ROWS) * STAGGER_MS : 0;

        return (
          <button
            key={entry.path}
            type="button"
            data-tree-path={entry.path}
            data-tree-root={root}
            data-tooltip={entry.path}
            aria-level={depth + 1}
            aria-expanded={entry.is_dir ? isExpanded(entry.path) : undefined}
            onClick={() => {
              if (entry.is_dir) onNavigate(entry.path);
              else onReveal(entry.path);
            }}
            onDoubleClick={() => {
              if (entry.is_dir) toggleExpanded(entry.path);
              else onOpenFile(entry.path, entry.name);
            }}
            onAuxClick={(event) => {
              if (event.button !== 1 || !entry.is_dir) return;
              event.preventDefault();
              onOpenTab(entry.path);
            }}
            onMouseDown={(event) => {
              // Sin esto la rueda activa el desplazamiento automático de WebView2.
              if (event.button === 1) event.preventDefault();
            }}
            onKeyDown={(event) => handleTreeKey(event, entry.path, entry.is_dir)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(entry, event.clientX, event.clientY);
            }}
            {...(drop && {
              onDragOver: (event: React.DragEvent) => {
                drop.onDragOver(event);
                if (!event.defaultPrevented || isExpanded(entry.path)) return;
                if (dragTimer.current?.path === entry.path) return;
                clearDragTimer();
                dragTimer.current = {
                  path: entry.path,
                  id: window.setTimeout(() => setExpanded(entry.path, true), DRAG_OPEN_MS),
                };
              },
              onDragLeave: (event: React.DragEvent) => {
                drop.onDragLeave(event);
                if (dragTimer.current?.path === entry.path) clearDragTimer();
              },
              onDrop: (event: React.DragEvent) => {
                clearDragTimer();
                drop.onDrop(event);
              },
            })}
            className={`${rowClass(active, dropPath === entry.path)} fw-tree-row absolute inset-x-0 ${
              enter ? "fw-tree-enter" : ""
            }`}
            style={{
              top: index * ROW,
              gap: 6,
              paddingLeft: 8 + (depth - 1) * INDENT,
              ...(enter && { animationDelay: `${delay}ms` }),
            }}
          >
            {entry.is_dir ? <TreeToggle path={entry.path} /> : <span className="inline-block w-3 shrink-0" />}
            <SmallEntryIcon entry={entry} />
            <span className="truncate">{names.entry(entry)}</span>
            <GitBadge path={entry.path} isDir={entry.is_dir} className="ml-auto" />
          </button>
        );
      })}
    </div>
  );
}
