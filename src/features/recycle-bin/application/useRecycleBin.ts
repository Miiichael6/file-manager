import { useCallback, useEffect, useRef, useState } from "react";

import { emptyRecycleBin, purgeRecycled, recycleBinState, restoreRecycled, type RecycleEntry, type RecycleState } from "../../../shared/application/fileops";
import { t } from "../../../shared/i18n/index";
import type { Options } from "./useRecycleBin.types";
/** Stav Koše (počet položek) a operace nad ním: obnovení, trvalé smazání, vysypání. */
export function useRecycleBin({ refreshTokens, runOperation, reportFailures, askAdmin, setConfirm, displayName }: Options) {
  /** Počet položek v Koši — ikona v sidebaru (prázdný / plný). */
  const [trashState, setTrashState] = useState<RecycleState | null>(null);
  const trashRequest = useRef(0);
  const trashTimer = useRef<number | undefined>(undefined);
  /** Dotaz je u plného Koše drahý a refreshToken roste i s každou změnou
   *  sledované složky — dotazy se proto slévají (300 ms) a starší odpověď
   *  novější nepřepíše. */
  const refreshTrashState = useCallback(() => {
    window.clearTimeout(trashTimer.current);
    trashTimer.current = window.setTimeout(() => {
      const id = ++trashRequest.current;
      recycleBinState()
        .then((state) => {
          if (trashRequest.current === id) setTrashState(state);
        })
        .catch(() => {
          if (trashRequest.current === id) setTrashState(null);
        });
    }, 300);
  }, []);
  // Po každé operaci (refreshToken), při návratu do okna a jednou za minutu —
  // Koš mění i Průzkumník a jiné aplikace.
  useEffect(refreshTrashState, [refreshTrashState, refreshTokens[0], refreshTokens[1]]);
  useEffect(() => {
    const timer = window.setInterval(refreshTrashState, 60_000);
    window.addEventListener("focus", refreshTrashState);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshTrashState);
    };
  }, [refreshTrashState]);

  /** Obnoví položky Koše na původní místo (obsazené místo nepřepíše). */
  const restoreRecycledItems = useCallback(
    (items: RecycleEntry[], elevate = false) => {
      if (items.length === 0) return;
      void runOperation("op.restore", async () => {
        const report = await restoreRecycled(items, elevate);
        const admin = report.failed.filter((item) => item.admin);
        reportFailures("op.restore", report.failed.filter((item) => !item.admin), items.length);
        if (admin.length > 0) {
          const retry = items.filter((item) => admin.some((failed) => failed.item === item.id));
          askAdmin(
            retry.map((item) => `${item.original_dir}\\${item.name}`),
            () => restoreRecycledItems(retry, true),
          );
        }
      });
    },
    [runOperation, reportFailures, askAdmin],
  );

  /** Trvale smaže vybrané položky Koše (s potvrzením). */
  const purgeRecycledItems = useCallback(
    (items: RecycleEntry[]) => {
      if (items.length === 0) return;
      const run = (targets: RecycleEntry[], elevate: boolean) =>
        void runOperation("op.delete", async () => {
          const report = await purgeRecycled(targets, elevate);
          const admin = report.failed.filter((item) => item.admin);
          reportFailures("op.delete", report.failed.filter((item) => !item.admin), targets.length);
          if (admin.length > 0) {
            const retry = targets.filter((item) => admin.some((failed) => failed.item === item.id));
            askAdmin(
              retry.map((item) => `${item.original_dir}\\${item.name}`),
              () => run(retry, true),
            );
          }
        });
      setConfirm({
        title:
          items.length === 1
            ? t("confirm.deleteOne", { name: displayName(items[0].name) })
            : t("confirm.deleteMany", { count: items.length }),
        message: t("confirm.purgeMessage"),
        confirmLabel: t("confirm.deleteConfirm"),
        danger: true,
        onConfirm: () => run(items, false),
      });
    },
    [runOperation, reportFailures, askAdmin, setConfirm, displayName],
  );

  const confirmEmptyTrash = useCallback(() => {
    setConfirm({
      title: t("confirm.emptyTrashTitle"),
      message: t("confirm.emptyTrashMessage"),
      confirmLabel: t("menu.emptyTrash"),
      danger: true,
      onConfirm: () => void runOperation("op.emptyTrash", emptyRecycleBin),
    });
  }, [runOperation, setConfirm]);

  return { trashState, refreshTrashState, restoreRecycledItems, purgeRecycledItems, confirmEmptyTrash };
}
