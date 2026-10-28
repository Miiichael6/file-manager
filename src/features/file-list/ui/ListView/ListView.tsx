import { memo, useEffect, useImperativeHandle, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp } from "lucide-react";

import { SmallEntryIcon } from "../../../../shared/ui/icons";
import { RenameInput } from "../RenameInput";
import { TagDots } from "../../../tags/ui/TagDots";
import { GitBadge } from "../../../git/ui/GitBadge"; // MI-FORK: Git integrado.
import { dragItemsFor, endDrag, startEntryDrag } from "../../application/dnd";
import { dropPropsFor, selectMods, useFolderDrop, useStableCallback } from "../../application/rowDnd";
import { sameEntry } from "../../application/rows";
import { useGlassInsets } from "../../../theme/application/glass";
import { tagsOf } from "../../../../shared/infrastructure/storage";
import { entryOpacity, formatModified, formatSize, kindLabel } from "../../../../shared/domain/format";
import type { SortKey } from "../../../../shared/domain/format.types";
import { useLocale, useT } from "../../../../shared/i18n/index";
import type { MessageKey } from "../../../../shared/i18n/index.types";
import type { FileEntry } from "../../../../shared/domain/types";
import { useDisplayNames } from "../../application/extensions";
// MI-FORK: agrupar por y tamaño de carpetas.
import { useExtrasSettings } from "../../../extras/application/extrasSettings";
import { groupedRows } from "../../application/grouping";
import { FolderSizeCell, GroupHeaderRow } from "../ListExtras";
import { useComputeFolderSizes } from "../../application/folderSizes";
import { DEFAULT_WIDTHS, useColumnWidths } from "../../application/columnWidths";
import type { ColumnWidths, ResizableColumn } from "../../application/columnWidths.types";
import { ColumnResizer } from "../ColumnResizer";
import { HorizontalScrollbar } from "../HorizontalScrollbar";
import type { ListViewProps, RowHandlers, RowProps } from "./ListView.types";

const COLUMNS: { key: SortKey; label: MessageKey; width: string; align: "left" | "right" }[] = [
  { key: "name", label: "sort.name", width: "minmax(0, 1fr)", align: "left" },
  // Data a velikosti doprava, s tabulárními číslicemi — čísla pod sebou lícují.
  { key: "modified", label: "sort.modified", width: "140px", align: "right" },
  { key: "size", label: "sort.size", width: "80px", align: "right" },
  { key: "kind", label: "sort.kind", width: "100px", align: "left" },
];

/** Sloupec s puntíky tagů stojí před Názvem a nemá hlavičku, jen prázdné místo. */
const TAG_COLUMN = "24px";

// MI-FORK: anchos ajustables. Con Nombre fijo, una pista de relleno al final
// se queda con el sobrante.
function gridTemplate(widths: ColumnWidths): string {
  return [
    TAG_COLUMN,
    ...COLUMNS.map((column) => {
      const key = column.key as ResizableColumn;
      const width = widths[key] ?? DEFAULT_WIDTHS[key];
      return width === null || !Number.isFinite(width) ? column.width : `${width}px`;
    }),
    ...(widths.name === null ? [] : ["minmax(0, 1fr)"]),
  ].join(" ");
}

/** MI-FORK: ancho mínimo del contenido con todas las columnas fijas (px-3 + tags + huecos gap-3). */
function minListWidth(widths: ColumnWidths): number | undefined {
  if (widths.name === null) return undefined;
  return 24 + 24 + widths.name + widths.modified + widths.size + widths.kind + 5 * 12;
}

/** Výška řádku i lepkavé hlavičky — virtualizace s ní počítá. */
const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;

/* ---------------------------------- řádek ---------------------------------- */

/**
 * Jeden řádek. Memoizovaný s porovnáním jen toho, co řádek ukazuje — klik na
 * jednu položku překreslí dva řádky (starý a nový výběr), ne celou složku.
 */
const ListRow = memo(
  function ListRow({
    entry,
    index,
    top,
    selected,
    cut,
    renaming,
    dropTarget,
    windowFocused,
    tags,
    handlers,
  }: RowProps) {
    // Druh, datum a velikost jsou v jazyce UI — memo by je po přepnutí nechalo.
    useLocale();
    const names = useDisplayNames();
    // Pruhování podle indexu, ne přes :nth-child — virtuální řádky nejsou
    // sourozenci v pořadí výpisu.
    const stripeClass = index % 2 === 1 ? "fw-stripe" : "";
    const stateClass =
      selected && !renaming ? (windowFocused ? "is-selected" : "is-selected-dim") : "";

    return (
      <div
        data-path={entry.path}
        role="option"
        aria-selected={selected}
        tabIndex={0}
        draggable={!renaming}
        onDragStart={(event) =>
          startEntryDrag(handlers.dragItems(entry), event)
        }
        onDragEnd={endDrag}
        {...dropPropsFor(entry, handlers.drop)}
        onClick={(event) => handlers.select(entry, selectMods(event))}
        onDoubleClick={() => handlers.open(entry)}
        onContextMenu={(event) => {
          event.preventDefault();
          // Nebublat na kontejner — ten má menu volné plochy. Výběr řeší
          // App: pravý klik do už vybrané skupiny ji nesmí shodit na jednu.
          event.stopPropagation();
          handlers.contextMenu(entry, event.clientX, event.clientY);
        }}
        className={`fw-list-row fw-row absolute right-0 left-0 grid h-6 items-center gap-3 px-3 text-[13px] text-primary ${stripeClass} ${stateClass} ${
          dropTarget ? "fw-drop-target" : ""
        }`}
        style={{
          top: 0,
          transform: `translateY(${top}px)`,
          gridTemplateColumns: handlers.gridTemplate,
          opacity: entryOpacity(entry, cut),
        }}
      >
        {/* Obal drží buňku v gridu i pro netagované řádky, kde TagDots nic nevrátí. */}
        <span className="flex items-center">
          <TagDots colors={tags} size={8} />
        </span>

        <div className="flex min-w-0 items-center gap-2">
          <SmallEntryIcon entry={entry} />
          {renaming ? (
            <RenameInput
              entry={entry}
              onSubmit={handlers.renameSubmit}
              onCancel={handlers.renameCancel}
            />
          ) : (
            <span className="truncate">{names.entry(entry)}</span>
          )}
          {/* MI-FORK: estado en Git. */}
          {!renaming && <GitBadge path={entry.path} isDir={entry.is_dir} />}
        </div>
        <span className="truncate text-right text-secondary tabular-nums">
          {formatModified(entry.modified)}
        </span>
        {/* MI-FORK: tamaño de carpetas calculado en segundo plano. */}
        {entry.is_dir && handlers.folderSizes ? (
          <FolderSizeCell path={entry.path} />
        ) : (
          <span className="truncate text-right text-secondary tabular-nums">
            {formatSize(entry.size, entry.is_dir)}
          </span>
        )}
        <span className="truncate text-secondary">{kindLabel(entry)}</span>
      </div>
    );
  },
  (a, b) =>
    sameEntry(a.entry, b.entry) &&
    a.index % 2 === b.index % 2 &&
    a.top === b.top &&
    a.selected === b.selected &&
    a.cut === b.cut &&
    a.renaming === b.renaming &&
    a.dropTarget === b.dropTarget &&
    a.windowFocused === b.windowFocused &&
    a.tags === b.tags &&
    a.handlers === b.handlers,
);

/* ---------------------------------- výpis ---------------------------------- */

export function ListView({
  entries,
  selectedPaths,
  cutPaths,
  windowFocused,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  sortKey,
  sortDirection,
  onSort,
  onSelect,
  onOpen,
  onContextMenu,
  onDropInto,
  tags,
  scrollRef,
  handleRef,
  initialOffset = 0,
  pane,
}: ListViewProps) {
  const t = useT();
  const SortArrow = sortDirection === "asc" ? ChevronUp : ChevronDown;
  const { dropTarget, handlers: drop } = useFolderDrop(onDropInto);
  // Sklo: výpis začíná pod lištou (padding scrolleru) a končí nad status barem.
  const glass = useGlassInsets();
  const rowsTop = HEADER_HEIGHT + glass.top;
  // MI-FORK: con «Agrupar por» hay filas de cabecera entre las entradas.
  const extras = useExtrasSettings();
  useComputeFolderSizes(entries, extras.folderSizes);
  const rows = useMemo(() => groupedRows(entries, extras.groupBy), [entries, extras.groupBy]);
  const columnWidths = useColumnWidths(pane);
  const template = gridTemplate(columnWidths);

  // Jen viditelné řádky + 10 navíc. Řádky začínají pod lepkavou hlavičkou,
  // proto scrollMargin; scrollPaddingStart drží vybraný řádek pod ní.
  const virtualizer = useVirtualizer({
    // Bez flushSync v obsluze scrollu: React 19 posun nových řádků slije do
    // jednoho vykreslení a hlavní vlákno nebrzdí začátek scrollovacího gesta.
    useFlushSync: false,
    count: rows.length, // MI-FORK: filas (entradas + cabeceras de grupo)
    getScrollElement: () => scrollRef.current,
    initialOffset,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: rowsTop,
    scrollPaddingStart: rowsTop,
    scrollPaddingEnd: glass.bottom,
  });

  // Stabilní handlery pro memoizované řádky — volají vždy nejnovější props.
  const select = useStableCallback(onSelect);
  const open = useStableCallback(onOpen);
  const contextMenu = useStableCallback((entry: FileEntry, x: number, y: number) =>
    onContextMenu?.(entry, x, y),
  );
  const dragItems = useStableCallback((entry: FileEntry) =>
    dragItemsFor(
      entry,
      entries.filter((item) => selectedPaths.has(item.path)),
    ),
  );
  const renameSubmit = useStableCallback(onRenameSubmit);
  const renameCancel = useStableCallback(onRenameCancel);
  // Všechny položky jsou stabilní, takže i objekt vznikne jen jednou.
  const handlers = useMemo<RowHandlers>(
    () => ({
      select,
      open,
      contextMenu,
      dragItems,
      renameSubmit,
      renameCancel,
      drop,
      folderSizes: extras.folderSizes,
      gridTemplate: template,
    }),
    [select, open, contextMenu, dragItems, renameSubmit, renameCancel, drop, extras.folderSizes, template],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      scrollToPath: (path, behavior = "auto") => {
        const index = rows.findIndex((row) => row.type === "entry" && row.entry.path === path); // MI-FORK
        if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto", behavior });
      },
      hitTest: (box) => {
        const element = scrollRef.current;
        if (!element) return [];
        const rect = element.getBoundingClientRect();
        if (box.right < rect.left || box.left > rect.right) return [];
        // Souřadnice obsahu: řádek i začíná v (horní lišta +) HEADER + i * ROW.
        const top = box.top - rect.top + element.scrollTop - rowsTop;
        const bottom = box.bottom - rect.top + element.scrollTop - rowsTop;
        const first = Math.max(0, Math.floor(top / ROW_HEIGHT));
        const last = Math.min(rows.length - 1, Math.floor(bottom / ROW_HEIGHT));
        // MI-FORK: las cabeceras de grupo no se seleccionan.
        return rows.slice(first, last + 1).flatMap((row) => (row.type === "entry" ? [row.entry.path] : []));
      },
      metrics: () => ({
        columns: 1,
        rowsPerPage: Math.max(
          1,
          Math.floor(((scrollRef.current?.clientHeight ?? 0) - rowsTop - glass.bottom) / ROW_HEIGHT) - 1,
        ),
      }),
    }),
    [rows, virtualizer, scrollRef, rowsTop, glass.bottom],
  );

  // Kontejner se mění s view mode — virtualizace ho musí přeměřit.
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer]);

  return (
    <div className="mi-list-root flex min-h-full min-w-0 flex-col" style={{ minWidth: minListWidth(columnWidths) }}>
      <div
        className="fw-list-header sticky top-0 z-10 grid h-6 shrink-0 items-center gap-3 border-b border-line bg-toolbar px-3 text-[11px] font-medium text-secondary"
        style={{ gridTemplateColumns: template, backdropFilter: "blur(20px)" }}
      >
        <span aria-hidden />

        {COLUMNS.map((column, index) => (
          <div key={column.key} className="relative flex h-full min-w-0 items-center">
            {/* MI-FORK: el divisor izquierdo de cada celda cambia el ancho de la
                columna anterior; la última lleva también el suyo a la derecha. */}
            {index > 0 && <ColumnResizer pane={pane} column={COLUMNS[index - 1].key as ResizableColumn} edge="left" />}
            {index === COLUMNS.length - 1 && <ColumnResizer pane={pane} column={column.key as ResizableColumn} edge="right" />}
            <button
              type="button"
              onClick={() => onSort(column.key)}
              className={`flex h-full w-full min-w-0 items-center gap-0.5 truncate hover:text-primary ${
                column.align === "right" ? "justify-end" : "justify-start"
              }`}
            >
              <span className="truncate">{t(column.label)}</span>
              {sortKey === column.key && <SortArrow size={11} strokeWidth={2.5} />}
            </button>
          </div>
        ))}
      </div>

      <div className="relative shrink-0" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          // MI-FORK: cabecera de grupo.
          const row = rows[item.index];
          if (row.type === "header") {
            return <GroupHeaderRow key={`group:${row.key}`} label={row.label} count={row.count} top={item.start - rowsTop} />;
          }
          const { entry } = row;
          return (
            <ListRow
              key={entry.path}
              entry={entry}
              index={row.index}
              top={item.start - rowsTop}
              selected={selectedPaths.has(entry.path)}
              cut={cutPaths.has(entry.path)}
              renaming={entry.path === renamingPath}
              dropTarget={dropTarget === entry.path}
              windowFocused={windowFocused}
              tags={tagsOf(tags, entry.path)}
              handlers={handlers}
            />
          );
        })}
      </div>

      <HorizontalScrollbar scrollRef={scrollRef} contentWidth={minListWidth(columnWidths)} />
    </div>
  );
}

