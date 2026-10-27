import { useEffect, useState } from "react";
import { ChevronDown, GitBranch, Zap, type LucideIcon } from "lucide-react";

import { ContextMenu, type MenuItem } from "../components/ContextMenu";
import { commandMenuItem } from "../components/Toolbar";
import type { Commands } from "../commands";
import { useT } from "../i18n";
import type { GitStatus } from "../lib/git";
import { gitBranches, gitCheckout, gitFetch, gitStage } from "../lib/gitActions";
import { gitMenuIcon } from "../lib/gitIcons";
import { motionMs } from "../lib/motion";
import "./git-toolbar.css";

/*
 * MI-FORK: dos botones de Git en la barra, solo dentro de un repositorio.
 * Rama (⑂ ▾): ramas locales para cambiar, Fetch y el panel Git.
 * Acciones rápidas (⚡ ▾): Pull, Push, Preparar todo, Commit… y terminal.
 * Al entrar o salir de un repositorio se abren / cierran a lo ancho con
 * fundido (git-toolbar.css), así los botones vecinos se desplazan sin saltos.
 */

type Props = {
  /** null = fuera de un repositorio: los botones se ocultan con animación. */
  status: GitStatus | null;
  commands: Commands;
  /** run de useGitIntegration: aviso traducido si git falla, mensaje si termina. */
  run: (operation: (root: string) => Promise<void>, done?: string) => void;
};

type Menu = { kind: "branch" | "quick"; x: number; y: number };

export function GitToolbarButtons({ status: live, commands, run }: Props) {
  const t = useT();
  const [menu, setMenu] = useState<Menu | null>(null);
  /** null = cargando la lista de ramas. */
  const [branches, setBranches] = useState<string[] | null>(null);
  /** Último estado conocido: mientras se cierran, los botones siguen visibles. */
  const [last, setLast] = useState<GitStatus | null>(live);
  /** false en el primer fotograma, para que la entrada tenga desde dónde animar. */
  const [open, setOpen] = useState(false);
  const inRepo = live !== null;

  useEffect(() => {
    if (inRepo) {
      const frame = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(frame);
    }
    setOpen(false);
    setMenu(null);
    const timer = window.setTimeout(() => setLast(null), motionMs("--dur-zoom"));
    return () => window.clearTimeout(timer);
  }, [inRepo]);

  useEffect(() => {
    if (live) setLast(live);
  }, [live]);

  const status = live ?? last;
  if (status === null) return null;
  const root = status.root;

  function toggle(kind: Menu["kind"]) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
      // Como los menús del Toolbar: mousedown + stopPropagation (si no, el
      // ContextMenu se cerraría y volvería a abrir con el mismo clic).
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      if (menu?.kind === kind) {
        setMenu(null);
        return;
      }
      setMenu({ kind, x: rect.left, y: rect.bottom + 4 });
      if (kind === "branch") {
        setBranches(null);
        gitBranches(root).then(setBranches, () => setBranches([]));
      }
    };
  }

  const current = status.branch;
  const branchItems: MenuItem[] = [
    ...(branches === null
      ? [
          {
            type: "item",
            label: t("git.loadingBranches"),
            disabled: true,
            onSelect: () => {},
          } satisfies MenuItem,
        ]
      : branches.length === 0
        ? [
            {
              type: "item",
              label: t("git.noBranches"),
              disabled: true,
              onSelect: () => {},
            } satisfies MenuItem,
          ]
        : branches.map((branch): MenuItem => ({
            type: "item",
            label: branch,
            checked: branch === current,
            onSelect: () => {
              if (branch !== current) run((root) => gitCheckout(root, branch), t("git.switched", { branch }));
            },
          }))),
    { type: "separator" },
    {
      type: "item",
      label: t("git.fetch"),
      onSelect: () => run(gitFetch, t("git.fetched")),
    },
    {
      ...commandMenuItem(commands.gitPanel, t("git.open")),
      icon: gitMenuIcon("panel"),
    },
  ];

  const changes = status.files.filter((file) => file.index !== "!").length;
  const quickItems: MenuItem[] = [
    {
      ...commandMenuItem(commands.gitPull, status.behind > 0 ? `${t("git.pull")}  ↓${status.behind}` : t("git.pull")),
      icon: gitMenuIcon("pull"),
    },
    {
      ...commandMenuItem(commands.gitPush, status.ahead > 0 ? `${t("git.push")}  ↑${status.ahead}` : t("git.push")),
      icon: gitMenuIcon("push"),
    },
    { type: "separator" },
    {
      type: "item",
      label: t("git.stageAll"),
      icon: gitMenuIcon("stage"),
      disabled: changes === 0,
      onSelect: () => run((root) => gitStage(root, ["."])),
    },
    {
      ...commandMenuItem(commands.gitPanel, t("git.commitEllipsis")),
      icon: gitMenuIcon("commit"),
    },
    { type: "separator" },
    commandMenuItem(commands.openTerminal),
  ];

  const branchLabel = t("git.branchButton", {
    branch: current ?? t("git.detached"),
  });

  return (
    <>
      <div className={`mi-git-presence ${open && inRepo ? "is-open" : ""}`} aria-hidden={!inRepo || undefined}>
        <div className="fw-tool-group">
          <PillButton
            Icon={GitBranch}
            label={branchLabel}
            open={menu?.kind === "branch"}
            onMouseDown={toggle("branch")}
          />
          <PillButton
            Icon={Zap}
            label={t("git.quickActions")}
            open={menu?.kind === "quick"}
            onMouseDown={toggle("quick")}
          />
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.kind === "branch" ? branchItems : quickItems}
          onClose={() => setMenu(null)}
          triggerSelector="[data-mi-git-trigger]"
          dropdown
        />
      )}
    </>
  );
}

function PillButton({
  Icon,
  label,
  open,
  onMouseDown,
}: {
  Icon: LucideIcon;
  label: string;
  open: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tooltip={label}
      aria-haspopup="menu"
      aria-expanded={open}
      data-mi-git-trigger
      onMouseDown={onMouseDown}
      className={`fw-tool-btn mi-git-btn ${open ? "is-open" : ""}`}
    >
      <Icon size={16} strokeWidth={1.75} />
      <ChevronDown size={12} strokeWidth={2} />
    </button>
  );
}
