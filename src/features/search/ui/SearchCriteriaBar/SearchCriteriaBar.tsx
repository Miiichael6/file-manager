import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Check, ChevronsUpDown, Minus, Plus, Search } from "lucide-react";

import { useT } from "../../../../shared/i18n/index";
import { DATE_OPS, DATE_UNITS, FIELDS, KINDS, NAME_OPS, SIZE_OPS, SIZE_UNITS, kindFormats, newRow } from "../../domain/searchCriteria";
import type { CriterionField, CriterionRow, KindId } from "../../domain/searchCriteria.types";
import type { SearchCriteriaBarProps } from "./SearchCriteriaBar.types";

/**
 * Lišta rozšířeného hledání nad výsledky: řádky „pole – podmínka – hodnota",
 * ± přidá / ubere řádek, dole místo hledání. Úpravy jsou koncept, dokud
 * uživatel nestiskne Hledat — jinak by se disk procházel při každém znaku.
 */
export function SearchCriteriaBar({ root, query, criteria, locations, onApply }: SearchCriteriaBarProps) {
  const t = useT();
  const [rows, setRows] = useState<CriterionRow[]>(() =>
    criteria.length > 0 ? criteria : [newRow("name", query)],
  );
  const [location, setLocation] = useState(root);

  const update = (id: number, change: (row: CriterionRow) => CriterionRow) =>
    setRows((current) => current.map((row) => (row.id === id ? change(row) : row)));

  const insertAfter = (id: number) =>
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      // Další řádek nabídne pole, které v liště ještě není.
      const used = new Set(current.map((row) => row.field));
      const field = FIELDS.find((item) => !used.has(item.id))?.id ?? "name";
      return [...current.slice(0, index + 1), newRow(field), ...current.slice(index + 1)];
    });

  const remove = (id: number) =>
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : [newRow("name")]));

  const apply = () => onApply(location, rows);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    }
  };

  const allLocations = locations.some((item) => item.path === location)
    ? locations
    : [{ path: location, label: location }, ...locations];

  return (
    <div className="fw-criteria flex flex-col gap-1.5 border-b border-line px-3 py-2 text-[12px]" onKeyDown={onKeyDown}>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-1.5">
          <Select
            value={row.field}
            label={t("criteria.field")}
            options={FIELDS.map((item) => ({ value: item.id, label: t(item.label) }))}
            onChange={(field) => update(row.id, () => ({ ...newRow(field as CriterionField), id: row.id }) as CriterionRow)}
            className="w-36"
          />
          <RowEditor row={row} onChange={(next) => update(row.id, () => next)} />
          <div className="ml-auto flex shrink-0 gap-1 pl-2">
            <button
              type="button"
              className="fw-criteria-step"
              title={t("criteria.remove")}
              aria-label={t("criteria.remove")}
              onClick={() => remove(row.id)}
            >
              <Minus size={11} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="fw-criteria-step"
              title={t("criteria.add")}
              aria-label={t("criteria.add")}
              onClick={() => insertAfter(row.id)}
            >
              <Plus size={11} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      ))}

      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-secondary">{t("criteria.location")}</span>
        <Select
          value={location}
          label={t("criteria.location")}
          options={allLocations.map((item) => ({ value: item.path, label: item.label }))}
          onChange={setLocation}
          className="w-48"
        />
        <button type="button" className="fw-criteria-search ml-auto" onClick={apply}>
          <Search size={12} strokeWidth={2.25} />
          {t("criteria.search")}
        </button>
      </div>
    </div>
  );
}

/** Podmínka a hodnota řádku — podle pole. */
function RowEditor({ row, onChange }: { row: CriterionRow; onChange: (row: CriterionRow) => void }) {
  const t = useT();

  switch (row.field) {
    case "name":
      return (
        <>
          <Select
            value={row.op}
            label={t("criteria.condition")}
            options={NAME_OPS.map((item) => ({ value: item.id, label: t(item.label) }))}
            onChange={(op) => onChange({ ...row, op: op as typeof row.op })}
            className="w-32"
          />
          <input
            type="text"
            value={row.value}
            autoFocus={row.value === ""}
            spellCheck={false}
            aria-label={t("criteria.value")}
            onChange={(event) => onChange({ ...row, value: event.target.value })}
            className="fw-criteria-input min-w-0 flex-1"
          />
        </>
      );

    case "kind": {
      const formats = kindFormats(row.kind);
      return (
        <>
          <span className="w-32 shrink-0 px-1 text-secondary">{t("criteria.is")}</span>
          <Select
            value={row.kind}
            label={t("criteria.kind")}
            options={KINDS.map((item) => ({ value: item.id, label: t(item.label) }))}
            onChange={(kind) => onChange({ ...row, kind: kind as KindId, format: "" })}
            className="w-32"
          />
          {formats.length > 0 && (
            <Select
              value={row.format}
              label={t("criteria.format")}
              options={[
                { value: "", label: t("criteria.anyFormat") },
                ...formats.map((format) => ({ value: format, label: format })),
              ]}
              onChange={(format) => onChange({ ...row, format })}
              className="w-28"
            />
          )}
        </>
      );
    }

    case "modified":
    case "created":
      return (
        <>
          <Select
            value={row.op}
            label={t("criteria.condition")}
            options={DATE_OPS.map((item) => ({ value: item.id, label: t(item.label) }))}
            onChange={(op) => onChange({ ...row, op: op as typeof row.op })}
            className="w-32"
          />
          {row.op === "withinLast" ? (
            <>
              <NumberInput value={row.amount} onChange={(amount) => onChange({ ...row, amount })} />
              <Select
                value={row.unit}
                label={t("criteria.unit")}
                options={DATE_UNITS.map((item) => ({ value: item.id, label: t(item.label) }))}
                onChange={(unit) => onChange({ ...row, unit: unit as typeof row.unit })}
                className="w-28"
              />
            </>
          ) : (
            <input
              type="date"
              value={row.date}
              aria-label={t("criteria.value")}
              onChange={(event) => onChange({ ...row, date: event.target.value })}
              className="fw-criteria-input w-36"
            />
          )}
        </>
      );

    case "size":
      return (
        <>
          <Select
            value={row.op}
            label={t("criteria.condition")}
            options={SIZE_OPS.map((item) => ({ value: item.id, label: t(item.label) }))}
            onChange={(op) => onChange({ ...row, op: op as typeof row.op })}
            className="w-32"
          />
          <NumberInput value={row.amount} onChange={(amount) => onChange({ ...row, amount })} />
          <Select
            value={row.unit}
            label={t("criteria.unit")}
            options={SIZE_UNITS.map((unit) => ({ value: unit, label: unit }))}
            onChange={(unit) => onChange({ ...row, unit: unit as typeof row.unit })}
            className="w-20"
          />
        </>
      );
  }
}

function Select({
  value,
  label,
  options,
  onChange,
  className = "",
}: {
  value: string;
  label: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight?: number;
    /** Svislý střed tlačítka — odtud se nabídka při otevření rozbalí. */
    originY: number;
  } | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const show = () => {
    setHighlight(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  // Nabídka se otevře přes tlačítko tak, aby vybraná položka ležela přesně na
  // něm a její text navazoval na text tlačítka. U okraje okna se posune dovnitř;
  // když se celá nevejde, posouvá se jen vnitřní seznam.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const trigger = triggerRef.current;
    const list = listRef.current;
    const scroller = scrollRef.current;
    if (!trigger || !list || !scroller) return;
    // Měří se přes offset*, ne getBoundingClientRect — nabídka se při otevření
    // animuje přes transform a obdélníky by byly zmenšené.
    const margin = 8;
    const rect = trigger.getBoundingClientRect();
    const triggerText = trigger.querySelector<HTMLElement>("[data-text]");
    const item = scroller.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    const itemText = item?.querySelector<HTMLElement>("[data-text]");
    if (!triggerText || !item || !itemText) return;

    const textShift = scroller.offsetLeft + itemText.offsetLeft - triggerText.offsetLeft;
    const width = Math.max(list.offsetWidth, rect.width + textShift);
    const left = Math.max(margin, Math.min(rect.left - textShift, window.innerWidth - width - margin));

    const available = window.innerHeight - 2 * margin;
    const maxHeight = list.offsetHeight > available ? available : undefined;
    const height = Math.min(list.offsetHeight, available);
    const itemTop = scroller.offsetTop + item.offsetTop;
    const aligned = rect.top + (rect.height - item.offsetHeight) / 2 - itemTop;
    const top = Math.max(margin, Math.min(aligned, window.innerHeight - height - margin));
    // Střed tlačítka v souřadnicích nabídky (u okraje okna nemusí být na vybrané položce).
    const originY = rect.top + rect.height / 2 - top;
    setPosition({ left, top, width, maxHeight, originY });
  }, [open, selectedIndex]);

  // Zavření klikem mimo, scrollem okolí, změnou velikosti nebo ztrátou fokusu okna.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      close();
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !position) return;
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight, position]);

  // Fokus zůstává na tlačítku (vzor combobox) — šipky, Enter i Esc řeší ono a dál
  // je nepouští: Enter by jinak spustil hledání a Esc zavřel výsledky.
  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        consume();
        show();
      }
      return;
    }
    const step = (index: number) => {
      consume();
      setHighlight(Math.min(last, Math.max(0, index)));
    };
    switch (event.key) {
      case "ArrowDown":
        return step(highlight + 1);
      case "ArrowUp":
        return step(highlight - 1);
      case "Home":
      case "PageUp":
        return step(0);
      case "End":
      case "PageDown":
        return step(last);
      case "Enter":
      case " ":
        consume();
        choose(highlight);
        return;
      case "Escape":
        consume();
        setOpen(false);
        return;
      case "Tab":
        setOpen(false);
        return;
      default:
        // Písmeno skočí na další položku, která jím začíná.
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const key = event.key.toLocaleLowerCase();
          for (let offset = 1; offset <= options.length; offset++) {
            const index = (highlight + offset) % options.length;
            if (options[index].label.toLocaleLowerCase().startsWith(key)) return step(index);
          }
        }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          triggerRef.current?.focus();
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={onKeyDown}
        className={`fw-criteria-select relative shrink-0 ${open ? "is-open" : ""} ${className}`}
      >
        <span data-text className="min-w-0 flex-1 truncate text-left">
          {options[selectedIndex]?.label}
        </span>
        <span aria-hidden className="fw-criteria-arrows">
          <ChevronsUpDown size={11} strokeWidth={2.5} />
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            // Podle atributu tooltipy a globální klávesy poznají otevřenou nabídku.
            data-fw-menu=""
            role="listbox"
            aria-label={label}
            className="fw-popover fw-menu fw-criteria-menu fixed z-[60] rounded-[7px] text-[12px]"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              minWidth: position?.width,
              transformOrigin: position ? `50% ${position.originY}px` : undefined,
              visibility: position ? undefined : "hidden",
            }}
          >
            {/* Posouvá se vnitřní vrstva, ne sama nabídka: skleněná ::before
                nabídky přesahuje o 1 px a ve scrolleru by vyrobila posuvníky. */}
            <div
              ref={scrollRef}
              className="fw-scroll relative overflow-y-auto overflow-x-hidden p-[5px]"
              style={{ maxHeight: position?.maxHeight, overflowY: position?.maxHeight ? "auto" : "hidden" }}
            >
            {options.map((option, index) => {
              const selected = index === selectedIndex;
              return (
                <div
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlight(index)}
                  // Bez výchozí akce mousedown zůstane fokus na tlačítku.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                  className={`fw-menu-item fw-criteria-option ${index === highlight ? "is-highlighted" : ""}`}
                >
                  <span className="flex w-3.5 shrink-0 justify-center">
                    {selected && <Check size={12} strokeWidth={2.5} />}
                  </span>
                  <span data-text className="truncate">
                    {option.label}
                  </span>
                </div>
              );
            })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const t = useT();
  return (
    <input
      type="number"
      min={0}
      value={Number.isFinite(value) ? value : ""}
      aria-label={t("criteria.value")}
      onChange={(event) => onChange(event.target.valueAsNumber)}
      className="fw-criteria-input w-16 shrink-0"
    />
  );
}
