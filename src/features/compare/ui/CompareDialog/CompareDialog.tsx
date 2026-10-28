import { useEffect, useMemo, useState } from "react";

import { Dialog } from "../../../../shared/ui/Dialog";
import { invoke } from "../../../../shared/infrastructure/fileops";
import { errorText, useT } from "../../../../shared/i18n/index";
import * as storage from "../../../../shared/infrastructure/storage";
import { diffLines, foldDiff, splitLines, type DiffRow } from "../../domain/textDiff";

/*
 * MI-FORK: comparar dos archivos de texto (menú contextual con dos archivos
 * seleccionados). Diff unificado con los números de línea de ambos lados y
 * los tramos iguales plegados.
 */

/** Como la vista previa de texto: más de 1 MB no se compara. */
const MAX_BYTES = 1024 * 1024;

type Loaded = { a: string; b: string; truncated: boolean };

function rowStyle(row: DiffRow): React.CSSProperties | undefined {
  if (row.type === "add") return { background: "var(--git-diff-add)" };
  if (row.type === "del") return { background: "var(--git-diff-del)" };
  return undefined;
}

export function CompareDialog({ left, right, onClose }: { left: string; right: string; onClose: () => void }) {
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    const read = (path: string) =>
      invoke<{ text: string; truncated: boolean }>("read_text_file", { path, maxBytes: MAX_BYTES });
    Promise.all([read(left), read(right)]).then(
      ([a, b]) => alive && setLoaded({ a: a.text, b: b.text, truncated: a.truncated || b.truncated }),
      (err: unknown) => alive && setError(err),
    );
    return () => {
      alive = false;
    };
  }, [left, right]);

  const diff = useMemo(() => {
    if (!loaded) return null;
    const lines = diffLines(splitLines(loaded.a), splitLines(loaded.b));
    const added = lines.filter((line) => line.type === "add").length;
    const removed = lines.filter((line) => line.type === "del").length;
    return { rows: foldDiff(lines), added, removed };
  }, [loaded]);

  const name = storage.lastSegment;

  return (
    <Dialog label={t("extras.compare.title")} width={860} onClose={onClose} actions={[{ label: t("common.close"), onClick: onClose }]}>
      <div className="flex flex-col gap-2 text-[13px]">
        <div className="flex min-w-0 items-center gap-2 text-[12px]">
          <span className="min-w-0 truncate rounded-[4px] px-1.5 py-0.5" style={{ background: "var(--git-diff-del)" }} title={left}>
            − {name(left)}
          </span>
          <span className="min-w-0 truncate rounded-[4px] px-1.5 py-0.5" style={{ background: "var(--git-diff-add)" }} title={right}>
            + {name(right)}
          </span>
          {diff && (
            <span className="ml-auto shrink-0 text-secondary tabular-nums">
              {t("extras.compare.summary", { added: diff.added, removed: diff.removed })}
            </span>
          )}
        </div>

        <div className="mi-dialog-well h-[420px] overflow-auto rounded-[6px] border border-line" style={{ background: "var(--bg-main)", userSelect: "text" }}>
          {error !== null ? (
            <p className="p-4 text-[12px] text-[color:var(--danger)]">{errorText(error)}</p>
          ) : !diff ? (
            <p className="p-4 text-[12px] text-secondary">{t("common.loading")}</p>
          ) : diff.added === 0 && diff.removed === 0 ? (
            <p className="p-4 text-[12px] text-secondary">{t("extras.compare.identical")}</p>
          ) : (
            <pre className="min-w-max py-2 font-mono text-[12px] leading-[18px] text-primary">
              {diff.rows.map((row, index) =>
                row.type === "fold" ? (
                  <div key={index} className="px-4 text-secondary" style={{ color: "var(--accent)" }}>
                    {`⋯ ${t("extras.compare.folded", { count: row.count })}`}
                  </div>
                ) : (
                  <div key={index} className="flex whitespace-pre" style={rowStyle(row)}>
                    <span className="w-12 shrink-0 pr-2 text-right text-secondary select-none">{row.type !== "add" ? row.a : ""}</span>
                    <span className="w-12 shrink-0 pr-2 text-right text-secondary select-none">{row.type !== "del" ? row.b : ""}</span>
                    <span className="w-4 shrink-0 text-secondary select-none">{row.type === "add" ? "+" : row.type === "del" ? "−" : ""}</span>
                    <span className="pr-4">{row.text || " "}</span>
                  </div>
                ),
              )}
            </pre>
          )}
        </div>
        {loaded?.truncated && <p className="text-[12px] text-secondary">{t("extras.compare.truncated")}</p>}
      </div>
    </Dialog>
  );
}
