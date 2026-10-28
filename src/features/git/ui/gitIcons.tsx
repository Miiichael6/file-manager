import { ArrowDown, ArrowUp, FileDiff, GitBranch, GitCommitHorizontal, Minus, Plus, type LucideIcon } from "lucide-react";
import type { GitIconName } from "./gitIcons.types";

/**
 * Ikony gitu na jednom místě — stejná ikona v kontextovém menu, v paletě,
 * v dialogu Git i v náhledu, ať se akce dají poznat na první pohled.
 */
export const GIT_ICONS = {
  panel: GitBranch,
  stage: Plus,
  unstage: Minus,
  pull: ArrowDown,
  push: ArrowUp,
  commit: GitCommitHorizontal,
  diff: FileDiff,
} satisfies Record<string, LucideIcon>;

/** Ikona do menu (16 px slot `.fw-menu-icon`, stejně jako ostatní položky). */
export function gitMenuIcon(name: GitIconName) {
  const Icon = GIT_ICONS[name];
  return <Icon size={15} strokeWidth={1.75} className="text-secondary" />;
}

const COMMAND_ICONS: Record<string, GitIconName> = {
  gitPanel: "panel",
  gitStage: "stage",
  gitUnstage: "unstage",
  gitPull: "pull",
  gitPush: "push",
};

/** Ikona příkazu gitu v paletě; null = není git příkaz (paleta použije výchozí). */
export function gitCommandIcon(id: string) {
  const name = COMMAND_ICONS[id];
  return name ? gitMenuIcon(name) : null;
}
