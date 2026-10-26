import { useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Minus, Plus } from "lucide-react";

import { Dialog } from "./Dialog";
import { GitDiffView } from "./GitDiffView";
import { GitLetter } from "./GitBadge";
import { errorText, useT } from "../i18n";
import { absolutePath, isStaged, isUnstaged, stateOf, type GitFile, type GitStatus } from "../lib/git";
import { gitCommit, gitPull, gitPush, gitStage, gitUnstage } from "../lib/gitActions";

type Selected = { path: string; staged: boolean; untracked: boolean } | null;

/** Jeden seznam souborů (Připraveno / Změny) s tlačítkem pro přesun do druhého. */
function FileList(props: {
  title: string;
  files: GitFile[];
  root: string;
  staged: boolean;
  selected: Selected;
  onSelect: (selected: Selected) => void;
  onToggle: (paths: string[]) => void;
}) {
  const t = useT();
  const { files, root, staged, selected } = props;
  const Icon = staged ? Minus : Plus;
  const action = t(staged ? "git.unstage" : "git.stage");
  const all = files.map((file) => absolutePath(root, file));

  return (
    <section className="min-w-0">
      <header className="flex items-center gap-2 px-1 pb-1 text-[11px] font-semibold text-secondary uppercase">
        <span className="flex-1">{`${props.title} (${files.length})`}</span>
        {files.length > 0 && (
          <button type="button" className="fw-button h-5! px-2! text-[11px]!" onClick={() => props.onToggle(all)}>
            {t(staged ? "git.unstageAll" : "git.stageAll")}
          </button>
        )}
      </header>
      <ul className="max-h-[140px] overflow-auto rounded-[6px] border border-line">
        {files.map((file, index) => {
          const path = all[index];
          const active = selected?.path === path && selected.staged === staged;
          return (
            <li
              key={path}
              onClick={() => props.onSelect({ path, staged, untracked: file.index === "?" })}
              className={`flex h-6 cursor-default items-center gap-2 px-2 text-[12px] text-primary ${active ? "bg-[color:var(--row-selected-inactive)]" : "hover:bg-hover"}`}
            >
              <span className="min-w-0 flex-1 truncate" data-tooltip={file.path}>{file.path}</span>
              <GitLetter state={stateOf(file)} />
              <button
                type="button"
                aria-label={action}
                data-tooltip={action}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onToggle([path]);
                }}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-hover"
              >
                <Icon size={12} strokeWidth={2.5} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Dialog Git (Ctrl+Shift+G nebo klik na větev ve status baru): seznam změn
 * s přípravou do commitu, diff vybraného souboru, commit se zprávou, push a pull.
 */
export function GitDialog({ status, onClose }: { status: GitStatus; onClose: () => void }) {
  const t = useT();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const { root } = status;

  const staged = status.files.filter(isStaged);
  const changes = status.files.filter(isUnstaged);

  async function act(operation: () => Promise<void>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await operation();
      after?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const commit = () => void act(() => gitCommit(root, message), () => setMessage(""));
  const canCommit = !busy && staged.length > 0 && message.trim() !== "";

  return (
    <Dialog label={t("git.title")} width={720} onClose={onClose} actions={[{ label: t("common.close"), onClick: onClose }]}>
      <div className="flex flex-col gap-3 text-[13px]">
        <div className="flex items-center gap-2">
          <GitBranch size={15} className="shrink-0 text-secondary" />
          <span className="min-w-0 flex-1 truncate font-semibold text-primary">
            {status.branch ?? t("git.detached")}
            {status.upstream && <span className="font-normal text-secondary">{` → ${status.upstream}`}</span>}
          </span>
          <button type="button" className="fw-button inline-flex items-center gap-1" disabled={busy} onClick={() => void act(() => gitPull(root))}>
            <ArrowDown size={13} /> {t("git.pull")} {status.behind > 0 && status.behind}
          </button>
          <button type="button" className="fw-button inline-flex items-center gap-1" disabled={busy} onClick={() => void act(() => gitPush(root))}>
            <ArrowUp size={13} /> {t("git.push")} {status.ahead > 0 && status.ahead}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FileList title={t("git.staged")} files={staged} root={root} staged selected={selected}
            onSelect={setSelected} onToggle={(paths) => void act(() => gitUnstage(root, paths))} />
          <FileList title={t("git.changes")} files={changes} root={root} staged={false} selected={selected}
            onSelect={setSelected} onToggle={(paths) => void act(() => gitStage(root, paths))} />
        </div>

        <div className="h-[220px] overflow-hidden rounded-[6px] border border-line" style={{ background: "var(--bg-main)" }}>
          {selected ? (
            <GitDiffView key={`${selected.path}|${selected.staged}`} root={root} path={selected.path}
              untracked={selected.untracked} staged={selected.staged} />
          ) : (
            <p className="p-4 text-[12px] text-secondary">{t("git.selectFile")}</p>
          )}
        </div>

        <textarea
          value={message}
          rows={3}
          spellCheck={false}
          placeholder={t("git.messagePlaceholder")}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.ctrlKey && canCommit) {
              event.preventDefault();
              commit();
            }
          }}
          className="w-full resize-none rounded-[6px] border border-line px-2 py-1.5 text-[13px] text-primary outline-none focus:border-[color:var(--accent)]"
          style={{ background: "var(--bg-main)", userSelect: "text" }}
        />
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-[12px] break-words text-[color:var(--danger)]" role="alert">{error}</p>
          <button type="button" className="fw-button is-primary" disabled={!canCommit} onClick={commit}>
            {t("git.commit")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
