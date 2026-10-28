export type GitDiffViewProps = {
  root: string;
  /** Absolutní cesta souboru. */
  path: string;
  untracked: boolean;
  /** Jen změny v indexu (co půjde do commitu); jinak vše proti HEAD. */
  staged?: boolean;
};
