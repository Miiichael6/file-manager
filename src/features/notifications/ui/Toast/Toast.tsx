import { CircleAlert, CircleCheck, X } from "lucide-react";

import { t } from "../../../../shared/i18n/index";
import type { Notice } from "../../application/useNotice";

type Props = {
  notice: Notice;
  expanded: boolean;
  closing: boolean;
  onClose: () => void;
  onToggleDetail: () => void;
};

/** Hláška plave nad status barem. Vnější obal centruje, vnitřní animuje —
 *  keyframes přepisují transform, takže by centrování translateX sežraly. */
export function Toast({ notice, expanded, closing, onClose, onToggleDetail }: Props) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{ bottom: 32 }}
    >
      <div
        role={notice.sticky ? "alert" : "status"}
        className={`fw-popover pointer-events-auto flex max-w-[70%] flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[8px] px-3 py-2 text-[13px] ${
          closing ? "fw-toast-out" : "fw-toast-in"
        }`}
      >
        {/* Chyba (zůstává) červeně, informace / úspěch zeleně. */}
        {notice.sticky ? (
          <CircleAlert size={16} strokeWidth={2} className="shrink-0" color="var(--danger)" aria-hidden />
        ) : (
          <CircleCheck size={16} strokeWidth={2} className="shrink-0" color="var(--success)" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-primary">{notice.text}</span>
        {/* Technický detail (kód a text Windows, seznam položek) až na požádání. */}
        {notice.detail && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggleDetail}
            className="shrink-0 text-[12px] text-secondary underline-offset-2 hover:text-primary hover:underline"
          >
            {expanded ? t("common.hideDetails") : t("common.details")}
          </button>
        )}
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="shrink-0 text-secondary hover:text-primary"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
        {notice.detail && expanded && (
          <pre className="max-h-40 w-full overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-secondary select-text">
            {notice.detail}
          </pre>
        )}
      </div>
    </div>
  );
}
