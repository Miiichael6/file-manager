import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../../../../shared/ui/EmptyState";
import { SmallEntryIcon } from "../../../../shared/ui/icons";
import { TagDots } from "../../../tags/ui/TagDots";
import { entryOpacity, formatModified, sortEntries } from "../../../../shared/domain/format";
import { parentPath, relativeParent } from "../../../../shared/application/fileops";
import { useT } from "../../../../shared/i18n/index";
import { tagsOf } from "../../../../shared/infrastructure/storage";
import { useStorage } from "../../../../shared/lib/useStorage";
import { useDisplayNames } from "../../../file-list/application/extensions";
import type { ResultsViewProps } from "./ResultsView.types";

/** Sloupec s puntíky, Název, Kde je, Datum úpravy. */
const GRID_TEMPLATE = "24px minmax(0, 1fr) minmax(0, 1.2fr) 140px";

/**
 * Seznam položek z různých složek — výsledky hledání i tag view. Chová se jako
 * Finder: jeden klik vybere, dvojklik otevře. Odkrytí v nadřazené složce je
 * v kontextovém menu (dřív to dělal jeden klik a dvojklik byl nedosažitelný).
 */
export function ResultsView({
  entries,
  loading,
  loadingMessage,
  error,
  empty,
  root,
  footer,
  windowFocused,
  selectedPath,
  onSelectionChange,
  onOpen,
  onContextMenu,
  onCountChange,
}: ResultsViewProps) {
  const names = useDisplayNames();
  const t = useT();
  const { tags } = useStorage();
  const selected = selectedPath;

  // Stejné řazení jako hlavní výpis — složky první, pak přirozeně podle názvu.
  const sorted = useMemo(() => sortEntries(entries, "name", "asc"), [entries]);

  useEffect(() => {
    onCountChange(sorted.length);
  }, [sorted.length, onCountChange]);

  // Výsledky po načítací obrazovce najedou postupně (řádek po řádku). Jen při
  // prvním zobrazení seznamu — přenačtení po operaci nechává řádky v klidu a nové
  // se objeví bez animace, jinak by seznam při každém smazání „poskočil".
  const showList = !(loading && entries.length === 0) && error === null && sorted.length > 0;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!showList) {
      setSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), 800);
    return () => window.clearTimeout(timer);
  }, [showList]);

  if (loading && entries.length === 0) {
    return (
      <div className="fw-results-loading flex h-full flex-col items-center justify-center gap-3 p-6 text-[13px] text-secondary">
        <span className="fw-spinner" aria-hidden />
        {loadingMessage}
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-secondary">
        {error}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="fw-results-empty h-full">
        <EmptyState {...empty} />
      </div>
    );
  }

  const selectedClass = windowFocused ? "bg-selected" : "bg-selected-inactive";

  /** ↑↓ Home End: posun výběru s fokusem, řádek se vždy doscrolluje do obrazu. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const current = sorted.findIndex((entry) => entry.path === selected);
    let index: number;
    switch (event.key) {
      case "ArrowDown":
        index = current < 0 ? 0 : current + 1;
        break;
      case "ArrowUp":
        index = current < 0 ? sorted.length - 1 : current - 1;
        break;
      case "Home":
        index = 0;
        break;
      case "End":
        index = sorted.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
    onSelectionChange(next);
    const row = event.currentTarget.querySelector<HTMLElement>(`[data-path="${CSS.escape(next.path)}"]`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div
      className="fw-results min-w-0"
      role="listbox"
      aria-label={t("results.label")}
      data-entering={settled ? undefined : ""}
      onKeyDown={handleKeyDown}
    >
      <div
        className="fw-list-header sticky top-0 z-10 grid h-6 items-center gap-3 border-b border-line bg-toolbar px-3 text-[11px] font-medium text-secondary"
        style={{ gridTemplateColumns: GRID_TEMPLATE, backdropFilter: "blur(20px)" }}
      >
        <span aria-hidden />
        <span className="truncate">{t("sort.name")}</span>
        <span className="truncate">{t("results.where")}</span>
        <span className="truncate">{t("sort.modified")}</span>
      </div>

      {sorted.map((entry, index) => {
        const isSelected = entry.path === selected;
        const where =
          root === undefined ? (parentPath(entry.path) ?? entry.path) : relativeParent(entry.path, root);

        return (
          <div
            key={entry.path}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            data-path={entry.path}
            data-tooltip={entry.path}
            onClick={() => onSelectionChange(entry)}
            // Fokus z klávesnice (Tab, šipka z pole hledání) vybírá taky.
            onFocus={() => onSelectionChange(entry)}
            onDoubleClick={() => onOpen(entry)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onOpen(entry);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelectionChange(entry);
              onContextMenu(entry, event.clientX, event.clientY);
            }}
            className={`fw-row fw-result-row grid h-6 items-center gap-3 px-3 text-[13px] text-primary ${
              isSelected ? selectedClass : "hover:bg-hover"
            }`}
            style={
              {
                gridTemplateColumns: GRID_TEMPLATE,
                opacity: entryOpacity(entry, false),
                "--i": index,
              } as React.CSSProperties
            }
          >
            <span className="flex items-center">
              <TagDots colors={tagsOf(tags, entry.path)} size={8} />
            </span>

            <div className="flex min-w-0 items-center gap-2">
              <SmallEntryIcon entry={entry} />
              <span className="truncate">{names.entry(entry)}</span>
            </div>

            {/* Prázdné "kde" ve výsledcích hledání = přímo v prohledávané složce. */}
            <span className="truncate text-secondary">{where === "" ? "—" : where}</span>
            <span className="truncate text-secondary">{formatModified(entry.modified)}</span>
          </div>
        );
      })}

      {footer}
    </div>
  );
}
