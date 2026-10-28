import { useCallback, useEffect, useState } from "react";

import { motionMs } from "../../../shared/lib/motion";

/** Jak dlouho hláška zůstane, než sama odjede. */
const TOAST_VISIBLE_MS = 2000;

export type Notice = { text: string; sticky: boolean; detail?: string };

/**
 * Hláška nad status barem. `sticky` = chyba, visí do kliknutí / Escape.
 * Informace mizí sama — ale „nemáte oprávnění" by se za dvě sekundy nedalo dočíst.
 */
export function useNotice() {
  const [notice, setNoticeState] = useState<Notice | null>(null);
  /** Rozbalený technický detail hlášky. */
  const [expanded, setExpanded] = useState(false);
  /** Hláška ještě visí, ale už odjíždí dolů. */
  const [closing, setClosing] = useState(false);

  /** Chybová hláška (zůstává). Stabilní identita — předává se i do useColumns. */
  const setNotice = useCallback((text: string | null, detail?: string) => {
    setExpanded(false);
    setNoticeState(text === null ? null : { text, sticky: true, detail });
  }, []);
  /** Informativní hláška, sama zmizí. */
  const showInfo = useCallback((text: string) => setNoticeState({ text, sticky: false }), []);

  // Informace se sama sveze dolů po dvou sekundách, chyba zůstává. Časovač
  // visí na `notice`, takže nová hláška ten starý zruší a odpočet začne znovu.
  useEffect(() => {
    if (notice === null) return;

    setClosing(false);
    if (notice.sticky) return;

    const startExit = window.setTimeout(() => setClosing(true), TOAST_VISIBLE_MS);
    return () => window.clearTimeout(startExit);
  }, [notice]);

  // Odjezd (automatický, křížkem i Escapem) dohraje animaci a pak hlášku zahodí.
  useEffect(() => {
    if (!closing) return;
    const remove = window.setTimeout(() => setNoticeState(null), motionMs("--dur-slow"));
    return () => window.clearTimeout(remove);
  }, [closing]);

  useEffect(() => {
    if (!notice?.sticky) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setClosing(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notice]);

  const close = useCallback(() => setClosing(true), []);
  const toggleExpanded = useCallback(() => setExpanded((open) => !open), []);

  return { notice, expanded, closing, setNotice, showInfo, close, toggleExpanded };
}
