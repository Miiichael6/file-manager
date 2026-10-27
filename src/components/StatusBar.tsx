import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Eye, EyeOff, Image, Info } from "lucide-react";
import { invoke } from "../fileops";
import { folderDisplayName } from "./icons";
import { breadcrumbs, formatFreeSpace, formatItemCount } from "../format";
import { useT } from "../i18n";
import { isTypingTarget } from "../lib/dom";
// MI-FORK: Git integrado.
import type { GitStatus } from "../lib/git";
import { GitBranchChip } from "./GitBranchChip";

/**
 * Vlastní komponenta schválně: mountuje se až ve chvíli editace, takže
 * useState dostane cestu hned při prvním renderu. Kdyby se hodnota
 * dosazovala efektem, select() by proběhl nad starou hodnotou a následný
 * re-render řízeného inputu by výběr zahodil (kurzor by skončil na konci).
 */
function PathInput({
  initial,
  onNavigate,
  onDone,
}: {
  initial: string;
  onNavigate: (path: string) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit() {
    const target = draft.trim();
    if (target.length === 0) {
      finished.current = true;
      onDone();
      return;
    }

    // Navigovat se dá jen tam, kam jde vypsat obsah — jinak zůstane input otevřený.
    try {
      await invoke("can_list_dir", { path: target });
      finished.current = true;
      onDone();
      onNavigate(target);
    } catch {
      setInvalid(true);
      inputRef.current?.focus();
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      spellCheck={false}
      onChange={(event) => {
        setDraft(event.target.value);
        setInvalid(false);
      }}
      onKeyDown={(event) => {
        // Ctrl+zkratky (nová záložka, paleta…) propustí dál — handler aplikace
        // v textovém poli pustí jen ty globální, Ctrl+A apod. patří poli.
        if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          void submit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          finished.current = true;
          onDone();
        }
      }}
      onBlur={() => {
        // Neplatnou cestu držíme otevřenou, ať uživatel nepřijde o rozepsané.
        if (!finished.current && !invalid) onDone();
      }}
      className="min-w-0 flex-1 rounded-sm px-1 text-[11px] text-primary outline-none"
      style={{
        background: "var(--bg-main)",
        border: `1px solid ${invalid ? "var(--danger)" : "var(--accent)"}`,
        userSelect: "text",
      }}
    />
  );
}

type StatusBarProps = {
  path: string | null;
  /** Počet po filtru. */
  itemCount: number;
  /** Počet ve složce bez filtru. */
  totalCount: number;
  /** Velká složka se ještě dočítá — kolik položek zatím dorazilo. */
  streamingCount?: number | null;
  filtered: boolean;
  /** Kolik položek je vybraných; 0 = ukazuje se jen počet. */
  selectedCount: number;
  freeSpace: number | null;
  onNavigate: (path: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** Pravý klik kamkoliv do lišty mimo editaci cesty. */
  onContextMenu: (x: number, y: number) => void;
  /** Zkopíruje aktuální cestu do schránky. */
  onCopyPath: () => void;
  /** MI-FORK: repo, ve kterém složka leží (větev vpravo); null mimo repo. */
  git?: GitStatus | null;
  onGitClick?: () => void;
};

/** MI-FORK: rychlé přepínače — skryté soubory, náhled, vlastnosti. */
type QuickBarProps = {
  showHidden: boolean;
  onToggleHidden: () => void;
  previewOpen: boolean;
  /** null = vybraná položka náhled nemá (složka, nic vybráno). */
  onPreview: (() => void) | null;
  /** Panel informací vpravo je otevřený. */
  infoOpen: boolean;
  /** null = zobrazení má vlastní panel (sloupce). */
  onInfo: (() => void) | null;
};

/** MI-FORK: ikonové tlačítko lišty (20 × 18, ikona 13 px). */
function QuickButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: (() => void) | null;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-tooltip={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={onClick === null}
      // Fokus zůstává ve výpisu (šipky), jako u tlačítek toolbaru.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onClick?.()}
      className={`fw-status-quick ${pressed ? "is-on" : ""}`}
    >
      {children}
    </button>
  );
}

/**
 * MI-FORK: lišta s rychlými přepínači dole v hlavní ploše (nad status barem,
 * vedle sidebaru). Leží přes výpis jako status bar — výšku drží
 * --quick-bar v index.css a GLASS_QUICK v lib/glass.ts.
 */
export function QuickBar({ showHidden, onToggleHidden, previewOpen, onPreview, infoOpen, onInfo }: QuickBarProps) {
  const t = useT();
  return (
    <div className="fw-quickbar">
      <QuickButton label={t("view.hiddenFiles")} pressed={showHidden} onClick={onToggleHidden}>
        {showHidden ? <Eye size={13} strokeWidth={1.75} /> : <EyeOff size={13} strokeWidth={1.75} />}
      </QuickButton>
      <QuickButton label={t("menu.quickLook")} pressed={previewOpen} onClick={onPreview}>
        <Image size={13} strokeWidth={1.75} />
      </QuickButton>
      <QuickButton label={t("info.panel")} pressed={infoOpen} onClick={onInfo}>
        <Info size={13} strokeWidth={1.75} />
      </QuickButton>
    </div>
  );
}

/** MI-FORK: jak dlouho po kliku svítí bublina „Zkopírováno". */
const COPIED_MS = 1200;

/**
 * MI-FORK: kopírování cesty s potvrzením. Bublina jde přes portál nad tlačítko —
 * globální vrstva tooltipů se při mousedown schová, takže tady vlastní.
 */
function CopyPathButton({ onCopy }: { onCopy: () => void }) {
  const t = useT();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [copiedAt, setCopiedAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (copiedAt === null) return;
    const timer = window.setTimeout(() => setCopiedAt(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copiedAt]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-tooltip={t("menu.copyCurrentPath")}
        aria-label={t("menu.copyCurrentPath")}
        onClick={() => {
          onCopy();
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setCopiedAt({ x: rect.left + rect.width / 2, y: rect.top });
        }}
        className="ml-1.5 flex shrink-0 cursor-default items-center rounded p-0.5 opacity-70 hover:text-primary hover:opacity-100"
      >
        {copiedAt ? (
          <Check size={11} strokeWidth={2.5} className="fw-copied-check" />
        ) : (
          <Copy size={11} strokeWidth={2} />
        )}
      </button>
      {copiedAt &&
        createPortal(
          <div
            role="status"
            className="fw-copied-bubble fw-tooltip fw-popover pointer-events-none fixed z-[70] rounded-md px-2 py-1 text-[11px] whitespace-nowrap text-primary"
            style={{ left: copiedAt.x, top: copiedAt.y - 6, translate: "-50% -100%" }}
          >
            <span className="block">{t("status.copied")}</span>
          </div>,
          document.body,
        )}
    </>
  );
}

export function StatusBar({
  path,
  itemCount,
  totalCount,
  streamingCount = null,
  filtered,
  selectedCount,
  freeSpace,
  onNavigate,
  editing,
  onEditingChange,
  onContextMenu,
  onCopyPath,
  git = null,
  onGitClick,
}: StatusBarProps) {
  const t = useT();
  const crumbs = path ? breadcrumbs(path) : [];

  // Jeden řetězec: dva textové uzly vedle sebe (počet + volné místo) by při
  // změně počtu posunuly ten druhý — layout shift.
  const counts = path
    ? streamingCount !== null
      ? t("status.loading", { count: streamingCount })
      : selectedCount > 0
        ? t("status.selected", { selected: selectedCount, count: itemCount })
        : filtered
          ? t("status.filtered", { shown: itemCount, count: totalCount })
          : formatItemCount(itemCount)
    : "";
  const summary = path && freeSpace !== null ? `${counts} · ${formatFreeSpace(freeSpace)}` : counts;

  return (
    // 22 px, 11 px písmo; drobky s › a podtržením při najetí, vpravo počty.
    <footer
      onContextMenu={(event) => {
        // V editaci cesty zůstává menu webview — kvůli Vložit.
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        onContextMenu(event.clientX, event.clientY);
      }}
      className="fw-statusbar flex h-[22px] shrink-0 items-center justify-between gap-4 border-t border-line bg-toolbar px-3 text-[11px] text-secondary">
      {editing ? (
        <PathInput
          initial={path ?? ""}
          onNavigate={onNavigate}
          onDone={() => onEditingChange(false)}
        />
      ) : (
        // key: jiná cesta = nové drobky. Přeskládání starých uzlů by se
        // počítalo jako posun obsahu (layout shift).
        // Klik do volného místa vedle drobků otevře editaci cesty (jako Průzkumník).
        <div
          key={path ?? ""}
          className="flex min-w-0 flex-1 cursor-text items-center self-stretch"
          onClick={(event) => {
            if (path !== null && event.target === event.currentTarget) onEditingChange(true);
          }}
        >
          {crumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex min-w-0 items-center">
              {index > 0 && <span className="px-1 opacity-60">›</span>}
              <button
                type="button"
                onClick={() => onNavigate(crumb.path)}
                className="truncate rounded px-0.5 underline-offset-2 hover:text-primary hover:underline"
              >
                {folderDisplayName(crumb.path, crumb.label)}
              </button>
            </span>
          ))}
          {path !== null && <CopyPathButton onCopy={onCopyPath} />}
        </div>
      )}

      {/* MI-FORK: rama de Git. */}
      {git && !editing && <GitBranchChip status={git} onClick={() => onGitClick?.()} />}

      {/* Pevná šířka: počty se při výběru mění ("1 z 2000 vybráno") a pružný
          blok by pokaždé posunul a přezkrátil drobky vlevo (layout shift).
          300 px unese i nejdelší anglickou variantu
          ("1,234 of 12,345 (filtered) · 85.9 GB free"). */}
      <div className="w-[300px] shrink-0 overflow-hidden text-right whitespace-nowrap tabular-nums">
        {/* key: nový uzel pro nový text. Přepsaný text zarovnaný vpravo by
            se posunul (jiná šířka) a hlásil se jako layout shift. */}
        <span key={summary}>{summary}</span>
      </div>
    </footer>
  );
}
