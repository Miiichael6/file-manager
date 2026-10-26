import { useT, type MessageKey } from "../i18n";
import type { GitState } from "../lib/git";
import { useGitState } from "../lib/gitStore";

/** Písmeno (jako v editorech), barva z index.css a popisek pro tooltip. */
export const GIT_LOOK: Record<GitState, { letter: string; color: string; label: MessageKey }> = {
  conflicted: { letter: "!", color: "var(--git-conflicted)", label: "git.state.conflicted" },
  deleted: { letter: "D", color: "var(--git-deleted)", label: "git.state.deleted" },
  modified: { letter: "M", color: "var(--git-modified)", label: "git.state.modified" },
  added: { letter: "A", color: "var(--git-added)", label: "git.state.added" },
  renamed: { letter: "R", color: "var(--git-added)", label: "git.state.renamed" },
  untracked: { letter: "U", color: "var(--git-untracked)", label: "git.state.untracked" },
  ignored: { letter: "I", color: "var(--git-ignored)", label: "git.state.ignored" },
};

/** Písmeno stavu bez napojení na store (seznam změn v dialogu Git). */
export function GitLetter({ state, className = "" }: { state: GitState; className?: string }) {
  const t = useT();
  const { letter, color, label } = GIT_LOOK[state];
  return (
    <span
      className={`${className} shrink-0 text-[11px] leading-none font-semibold tabular-nums`}
      style={{ color }}
      data-tooltip={t(label)}
      aria-label={t(label)}
    >
      {letter}
    </span>
  );
}

/**
 * Stav položky v gitu za názvem (M, U, A, D, R, !, I). Složka se změnami
 * uvnitř dostane tečku v barvě nejzávažnějšího stavu. Mimo repo a u čistých
 * položek nic nevykreslí.
 */
export function GitBadge({
  path,
  isDir,
  className = "ml-auto",
}: {
  path: string;
  isDir: boolean;
  /** Umístění — v řádku vpravo, v icon view v rohu dlaždice. */
  className?: string;
}) {
  const t = useT();
  const state = useGitState(path, isDir);
  if (state === null) return null;

  // Nesledovaná / ignorovaná složka jako celek dostane písmeno, jinak tečku.
  if (isDir && state !== "untracked" && state !== "ignored") {
    const { color, label } = GIT_LOOK[state];
    return (
      <span
        className={`${className} inline-block h-1.5 w-1.5 shrink-0 rounded-full`}
        style={{ backgroundColor: color }}
        data-tooltip={t(label)}
        aria-label={t(label)}
      />
    );
  }

  return <GitLetter state={state} className={className} />;
}
