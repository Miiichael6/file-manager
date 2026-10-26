import { useMemo } from "react";

import { errorText, useT } from "../i18n";
import { useGitDiff } from "../lib/gitActions";

/** Nad tolik řádků se diff nevykresluje celý — DOM by zbytečně rostl. */
const MAX_LINES = 5000;

/** Barva řádku podle prvního znaku unified diffu. */
function lineStyle(line: string): React.CSSProperties | undefined {
  if (line.startsWith("+++") || line.startsWith("---")) return { color: "var(--text-secondary)" };
  if (line.startsWith("+")) return { background: "var(--git-diff-add)" };
  if (line.startsWith("-")) return { background: "var(--git-diff-del)" };
  if (line.startsWith("@@")) return { color: "var(--accent)" };
  if (/^(diff |index |new file|deleted file|similarity|rename |old mode|new mode)/.test(line)) {
    return { color: "var(--text-secondary)" };
  }
  return undefined;
}

type GitDiffViewProps = {
  root: string;
  /** Absolutní cesta souboru. */
  path: string;
  untracked: boolean;
  /** Jen změny v indexu (co půjde do commitu); jinak vše proti HEAD. */
  staged?: boolean;
};

/**
 * Unified diff jednoho souboru: přidané řádky zeleně, odebrané červeně.
 * Používá ho náhled (přepínač Diff) i dialog Git.
 */
export function GitDiffView({ root, path, untracked, staged = false }: GitDiffViewProps) {
  const t = useT();
  const { text, truncated, error } = useGitDiff(root, path, untracked, staged);

  const lines = useMemo(() => {
    if (text === null) return [];
    const all = text.replace(/\n$/, "").split("\n");
    return all.length > MAX_LINES ? all.slice(0, MAX_LINES) : all;
  }, [text]);

  if (error) return <p className="p-4 text-[12px] text-[color:var(--danger)]">{errorText(error)}</p>;
  if (text === null) return <p className="p-4 text-[12px] text-secondary">{t("common.loading")}</p>;
  if (text.trim() === "") return <p className="p-4 text-[12px] text-secondary">{t("git.noDiff")}</p>;

  return (
    <div className="h-full w-full overflow-auto" style={{ userSelect: "text" }}>
      <pre className="min-w-max py-2 font-mono text-[12px] leading-[18px] text-primary">
        {lines.map((line, index) => (
          <div key={index} className="px-4 whitespace-pre" style={lineStyle(line)}>
            {line || " "}
          </div>
        ))}
      </pre>
      {(truncated || lines.length === MAX_LINES) && (
        <p className="px-4 pb-3 text-[12px] text-secondary">{t("git.diffTruncated")}</p>
      )}
    </div>
  );
}
