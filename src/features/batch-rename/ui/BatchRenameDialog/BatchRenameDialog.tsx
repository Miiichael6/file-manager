import { useState } from "react";

import { Dialog } from "../../../../shared/ui/Dialog";
import { useT } from "../../../../shared/i18n/index";
import type { MessageKey } from "../../../../shared/i18n/index.types";
import { previewRename } from "../../domain/batchRename";
import type { RenameOptions, Status } from "../../domain/batchRename.types";
import type { Props } from "./BatchRenameDialog.types";

/*
 * MI-FORK: diálogo «Renombrar varios»: buscar y reemplazar (texto o regex) o
 * patrón con numeración; la vista previa marca los nombres que no valen.
 */

const STATUS_TEXT: Record<Exclude<Status, "ok" | "same">, MessageKey> = {
  invalid: "extras.rename.invalid",
  duplicate: "extras.rename.duplicate",
  exists: "extras.rename.exists",
  badRegex: "extras.rename.badRegex",
};

const inputClass =
  "mi-dialog-field min-w-0 rounded-[6px] border border-line px-2 py-1 text-[13px] text-primary outline-none focus:border-[color:var(--accent)]";
const inputStyle = { background: "var(--bg-main)", userSelect: "text" } as const;

export function BatchRenameDialog({ entries, siblings, onApply, onClose }: Props) {
  const t = useT();
  const [mode, setMode] = useState<RenameOptions["mode"]>("replace");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [regex, setRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [includeExt, setIncludeExt] = useState(false);
  const [pattern, setPattern] = useState("[name] [n]");
  const [start, setStart] = useState(1);
  const [pad, setPad] = useState(2);

  const options: RenameOptions =
    mode === "replace"
      ? { mode, find, replace, regex, matchCase, includeExt }
      : { mode, pattern, start, pad };
  // Lotes de decenas o cientos de nombres: recalcular en cada tecla no cuesta nada.
  const previews = previewRename(entries, siblings, options);

  const changes = previews.filter((preview) => preview.status === "ok");
  const blocked = previews.some((preview) => preview.status !== "ok" && preview.status !== "same");
  const canApply = changes.length > 0 && !blocked;
  const apply = () => canApply && onApply(changes);

  const check = (label: string, value: boolean, set: (value: boolean) => void) => (
    <label className="flex items-center gap-1.5 text-[12px] text-secondary">
      <input type="checkbox" checked={value} onChange={(event) => set(event.target.checked)} />
      {label}
    </label>
  );

  return (
    <Dialog
      label={t("extras.rename.title")}
      width={640}
      onClose={onClose}
      actions={[
        { label: t("common.cancel"), onClick: onClose },
        { label: t("extras.rename.apply", { count: changes.length }), onClick: apply, kind: "primary", disabled: !canApply },
      ]}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <div className="mi-mode-switch flex gap-1" role="group">
          {(["replace", "pattern"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              className={`fw-button ${mode === item ? "is-primary" : ""}`}
              onClick={() => setMode(item)}
            >
              {t(item === "replace" ? "extras.rename.modeReplace" : "extras.rename.modePattern")}
            </button>
          ))}
        </div>

        {mode === "replace" ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[110px_1fr] items-center gap-2">
              <span className="text-secondary">{t("extras.rename.find")}</span>
              <input autoFocus value={find} spellCheck={false} onChange={(e) => setFind(e.target.value)} className={inputClass} style={inputStyle} />
              <span className="text-secondary">{t("extras.rename.replaceWith")}</span>
              <input value={replace} spellCheck={false} onChange={(e) => setReplace(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <div className="flex flex-wrap gap-4 pl-[118px]">
              {check(t("extras.rename.regex"), regex, setRegex)}
              {check(t("extras.rename.matchCase"), matchCase, setMatchCase)}
              {check(t("extras.rename.includeExt"), includeExt, setIncludeExt)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[110px_1fr] items-center gap-2">
              <span className="text-secondary">{t("extras.rename.pattern")}</span>
              <input autoFocus value={pattern} spellCheck={false} onChange={(e) => setPattern(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <p className="pl-[118px] text-[12px] text-secondary">{t("extras.rename.tokens")}</p>
            <div className="flex items-center gap-2 pl-[118px] text-[12px] text-secondary">
              {t("extras.rename.start")}
              <input type="number" value={start} onChange={(e) => setStart(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={`${inputClass} w-20`} style={inputStyle} />
              {t("extras.rename.digits")}
              <input type="number" min={1} max={9} value={pad} onChange={(e) => setPad(Math.min(9, Math.max(1, Math.floor(Number(e.target.value) || 1))))} className={`${inputClass} w-16`} style={inputStyle} />
            </div>
          </div>
        )}

        <div className="mi-dialog-well h-[260px] overflow-auto rounded-[6px] border border-line" style={{ background: "var(--bg-main)" }}>
          <table className="w-full table-fixed text-[12px]">
            <thead className="sticky top-0 text-left text-secondary" style={{ background: "var(--bg-main)" }}>
              <tr>
                <th className="px-2 py-1 font-medium">{t("extras.rename.before")}</th>
                <th className="px-2 py-1 font-medium">{t("extras.rename.after")}</th>
              </tr>
            </thead>
            <tbody>
              {previews.map(({ entry, next, status }) => {
                const problem = status !== "ok" && status !== "same";
                return (
                  <tr key={entry.path} title={problem ? t(STATUS_TEXT[status]) : undefined}>
                    <td className="truncate px-2 py-0.5 text-secondary">{entry.name}</td>
                    <td
                      className={`truncate px-2 py-0.5 ${status === "same" ? "text-secondary" : "text-primary"}`}
                      style={problem ? { color: "var(--danger)" } : undefined}
                    >
                      {next}
                      {problem && ` — ${t(STATUS_TEXT[status])}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
