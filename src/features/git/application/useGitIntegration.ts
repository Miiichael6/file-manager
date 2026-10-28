import { useCallback, useState } from "react";

import type { CommandHandler } from "../../command-palette/domain/commands";
import type { MenuItem } from "../../../shared/ui/ContextMenu";
import { errorDetail } from "../../../shared/infrastructure/fileops";
import { errorText, useT } from "../../../shared/i18n/index";
import type { FileEntry } from "../../../shared/domain/types";
import { isStaged, isUnstaged } from "./git";
import { gitPull, gitPush, gitStage, gitUnstage, useGitRepo } from "./gitActions";
import { gitFileFor } from "./gitStore";
import { gitMenuIcon } from "../ui/gitIcons";

export type GitCommandId = "gitPanel" | "gitStage" | "gitUnstage" | "gitPull" | "gitPush";

type Options = {
  /** Složka aktivního panelu. */
  dir: string | null;
  /** Mění se s obsahem výpisu — změna na disku obnoví i stav gitu. */
  token: unknown;
  /** Vybrané položky (cíle příkazů Stage / Unstage). */
  targets: FileEntry[];
  setNotice: (text: string | null, detail?: string) => void;
  showInfo: (text: string) => void;
};

/** Které z položek jde přidat do indexu / z něj vyndat. Složky bere git celé. */
function split(entries: FileEntry[]) {
  const stage: string[] = [];
  const unstage: string[] = [];
  for (const entry of entries) {
    const found = gitFileFor(entry.path);
    if (entry.is_dir) {
      stage.push(entry.path);
      unstage.push(entry.path);
    } else if (found) {
      if (isUnstaged(found.file)) stage.push(entry.path);
      if (isStaged(found.file)) unstage.push(entry.path);
    }
  }
  return { stage, unstage };
}

/**
 * Git pro App: stav repa aktivního panelu, příkazy (paleta, zkratky),
 * položky kontextového menu a stav dialogu. App jen napojí výsledek.
 */
export function useGitIntegration({ dir, token, targets, setNotice, showInfo }: Options) {
  const t = useT();
  const status = useGitRepo(dir, token);
  const [dialogOpen, setDialogOpen] = useState(false);
  const root = status?.root ?? null;

  const run = useCallback(
    (operation: (root: string) => Promise<void>, done?: string) => {
      if (root === null) return;
      operation(root).then(
        () => done && showInfo(done),
        (err: unknown) => setNotice(`${t("git.failed")}: ${errorText(err)}`, errorDetail(err)),
      );
    },
    [root, t, showInfo, setNotice],
  );

  const selection = split(targets);
  const inRepo = status !== null;

  const handlers: Record<GitCommandId, CommandHandler> = {
    gitPanel: { run: () => setDialogOpen(true), enabled: inRepo },
    gitStage: { run: () => run((r) => gitStage(r, selection.stage)), enabled: inRepo && selection.stage.length > 0 },
    gitUnstage: {
      run: () => run((r) => gitUnstage(r, selection.unstage)),
      enabled: inRepo && selection.unstage.length > 0,
    },
    gitPull: { run: () => run(gitPull, t("git.pulled")), enabled: inRepo },
    gitPush: { run: () => run(gitPush, t("git.pushed")), enabled: inRepo },
  };

  /** Položky kontextového menu pro dané cíle; prázdné mimo repo. */
  const menuItems = useCallback(
    (entries: FileEntry[]): MenuItem[] => {
      if (!inRepo) return [];
      const { stage, unstage } = split(entries);
      if (stage.length === 0 && unstage.length === 0) return [];
      return [
        { type: "separator" },
        {
          type: "item",
          label: t("git.stage"),
          icon: gitMenuIcon("stage"),
          disabled: stage.length === 0,
          onSelect: () => run((r) => gitStage(r, stage)),
        },
        {
          type: "item",
          label: t("git.unstage"),
          icon: gitMenuIcon("unstage"),
          disabled: unstage.length === 0,
          onSelect: () => run((r) => gitUnstage(r, unstage)),
        },
        {
          type: "item",
          label: t("git.open"),
          icon: gitMenuIcon("panel"),
          shortcut: "Ctrl+Shift+G",
          onSelect: () => setDialogOpen(true),
        },
      ];
    },
    [inRepo, run, t],
  );

  return { status, dialogOpen, setDialogOpen, handlers, menuItems, run };
}
