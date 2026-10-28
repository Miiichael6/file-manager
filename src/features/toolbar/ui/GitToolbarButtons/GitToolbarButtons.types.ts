import type { GitStatus } from "../../../git/domain/git.types";
import type { Commands } from "../../../command-palette/domain/commands.types";

export type Props = {
  /** null = fuera de un repositorio: los botones se ocultan con animación. */
  status: GitStatus | null;
  commands: Commands;
  /** run de useGitIntegration: aviso traducido si git falla, mensaje si termina. */
  run: (operation: (root: string) => Promise<void>, done?: string) => void;
  /** Botones que entran y salen junto con los de Git. */
  extra?: React.ReactNode;
};

export type Menu = { kind: "branch" | "quick"; x: number; y: number };
