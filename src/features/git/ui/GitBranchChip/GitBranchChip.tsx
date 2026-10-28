import { GitBranch } from "lucide-react";

import { useT } from "../../../../shared/i18n/index";
import type { GitStatus } from "../../domain/git.types";

/**
 * Větev ve status baru: název, ↑ commity k odeslání, ↓ k přijetí a počet
 * změněných souborů. Klik otevře dialog Git.
 */
export function GitBranchChip({ status, onClick }: { status: GitStatus; onClick: () => void }) {
  const t = useT();
  const changes = status.files.filter((file) => file.index !== "!").length;
  const branch = status.branch ?? t("git.detached");

  return (
    <button
      type="button"
      onClick={onClick}
      data-tooltip={t("git.open")}
      className="ml-auto flex max-w-[220px] shrink-0 items-center gap-1 rounded px-1 tabular-nums hover:bg-hover hover:text-primary"
    >
      <GitBranch size={12} strokeWidth={2} className="shrink-0" aria-hidden />
      <span className="truncate">{branch}</span>
      {status.ahead > 0 && <span>{`↑${status.ahead}`}</span>}
      {status.behind > 0 && <span>{`↓${status.behind}`}</span>}
      {changes > 0 && <span style={{ color: "var(--git-modified)" }}>{`●${changes}`}</span>}
    </button>
  );
}
