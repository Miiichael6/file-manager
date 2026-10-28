import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Panel } from "../../navigation/application/panel";
import type { PanelSearch } from "../../search/domain/searchCriteria";
import * as storage from "../../../shared/infrastructure/storage";
import { type MessageKey, failure } from "../../../shared/i18n/index";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { errorDetail, clipboardWriteFiles, clipboardHasFiles, clipboardReadFiles, parentPath, statPaths, type OnConflict, copyPath, movePath, needsAdmin, transferElevated, type ItemFailure, clipboardClear } from "../../../shared/infrastructure/fileops";
import { type FileEntry, type StatResult, type OpResult, type Clipboard, type TagColor } from "../../../shared/domain/types";
import { type ConflictRequest, type ConflictAnswer } from "../../dialogs/ui/ConflictDialog";
import { type UndoOp } from "../../history/application/undo";

type UseClipboardTransferOptions = {
  setNotice: (text: string | null, detail?: string) => void;
  setClipboard: Dispatch<SetStateAction<Clipboard | null>>;
  targetEntries: FileEntry[];
  setClipboardHasItems: Dispatch<SetStateAction<boolean>>;
  askConflict: (request: ConflictRequest) => Promise<ConflictAnswer | null>;
  runBatch: <T>(label: MessageKey, items: T[], action: (item: T) => Promise<unknown>) => Promise<{ ok: number; failed: number; }>;
  record: (op: UndoOp) => void;
  noteSkippedLinks: (count: number) => void;
  askAdmin: (paths: string[], retry: () => void) => void;
  runOperation: (label: MessageKey, action: () => Promise<unknown>) => Promise<void>;
  reportFailures: (label: MessageKey, failed: ItemFailure[], count: number) => void;
  currentDir: string | null;
  clipboard: Clipboard | null;
  otherPanel: Panel | null;
  search: PanelSearch | null;
  tagFilter: TagColor | null;
  trashView: boolean;
};

export function useClipboardTransfer({
  setNotice,
  setClipboard,
  targetEntries,
  setClipboardHasItems,
  askConflict,
  runBatch,
  record,
  noteSkippedLinks,
  askAdmin,
  runOperation,
  reportFailures,
  currentDir,
  clipboard,
  otherPanel,
  search,
  tagFilter,
  trashView,
}: UseClipboardTransferOptions) {
  /** `failed` = hláška pro případ, že schránka zápis odmítne. */
  const copyText = useCallback((text: string, failed: MessageKey) => {
    writeText(text).catch((err: unknown) => setNotice(failure(failed, err), errorDetail(err)));
  }, []);

  /** Cesty jako soubory do schránky Windows — vloží je Průzkumník, Outlook
   *  i prohlížeč. Interní kopie se drží jen kvůli vzhledu vyjmutých. */
  const putOnClipboard = useCallback(
    (paths: string[], mode: "copy" | "cut") => {
      if (paths.length === 0) return;
      setClipboard({ paths, mode });
      clipboardWriteFiles(paths, mode === "cut").catch((err: unknown) => {
        setClipboard(null);
        setNotice(failure("op.clipboard", err), errorDetail(err));
      });
    },
    [setNotice],
  );

  const copyToClipboard = useCallback(
    (mode: "copy" | "cut", items: FileEntry[] = targetEntries) => {
      putOnClipboard(items.map((entry) => entry.path), mode);
    },
    [targetEntries, putOnClipboard],
  );

  /** Stav schránky pro „Vložit" v menu — čte se při otevření, ne v intervalu. */
  const checkClipboard = useCallback(() => {
    clipboardHasFiles()
      .then(setClipboardHasItems)
      .catch(() => setClipboardHasItems(false));
  }, []);

  // Návrat do okna: schránku mohl mezitím přepsat kdokoli jiný (Ctrl+X
  // v Průzkumníku, zkopírovaný text). Průhlednost vyjmutých jde za ní.
  useEffect(() => {
    function sync() {
      clipboardReadFiles()
        .then((files) => {
          setClipboard((current) => {
            if (files === null) return null;
            const mode = files.cut ? "cut" : "copy";
            const same =
              current !== null &&
              current.mode === mode &&
              current.paths.length === files.paths.length &&
              current.paths.every((path, index) => storage.samePath(path, files.paths[index]));
            return same ? current : { paths: files.paths, mode };
          });
        })
        .catch(() => undefined);
    }
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  /**
   * Kopie nebo přesun cest do složky `target` — společné pro Vložit
   * a přetažení na složku. Vrací, kolik položek prošlo.
   */
  const transfer = useCallback(
    async (sources: string[], target: string, mode: "copy" | "cut"): Promise<number> => {
      // Přesun tam, kde položka už je, nic nedělá — dřív z toho byla "X (kopie)".
      const paths =
        mode === "cut"
          ? sources.filter((path) => {
              const parent = parentPath(path);
              return parent === null || !storage.samePath(parent, target);
            })
          : sources;
      if (paths.length === 0) return 0;

      // Kolize: položka stejného jména v cíli. Zjistí se předem, jedním
      // voláním, a na každou se zeptá dialog (dokud nepadne "pro všechny").
      // Kopie do vlastní složky se neptá — tam je "ponechat obě" jediné rozumné.
      const destination = (path: string) =>
        target.endsWith("\\") ? `${target}${storage.lastSegment(path)}` : `${target}\\${storage.lastSegment(path)}`;
      let sourceStats: StatResult[];
      let targetStats: StatResult[];
      try {
        [sourceStats, targetStats] = await Promise.all([
          statPaths(paths),
          statPaths(paths.map(destination)),
        ]);
      } catch (err: unknown) {
        setNotice(failure("op.checkTarget", err), errorDetail(err));
        return 0;
      }
      const collides = paths.map((path, index) => {
        const parent = parentPath(path);
        return targetStats[index]?.entry != null && !(parent !== null && storage.samePath(parent, target));
      });

      let remaining = collides.filter(Boolean).length;
      let forAll: OnConflict | null = null;
      const plan: { path: string; onConflict: OnConflict }[] = [];

      for (const [index, path] of paths.entries()) {
        let onConflict: OnConflict = "rename";
        const source = sourceStats[index]?.entry;
        const found = targetStats[index]?.entry;

        if (collides[index] && source && found) {
          remaining -= 1;
          if (forAll !== null) {
            onConflict = forAll;
          } else {
            const answer = await askConflict({ source, existing: found, targetDir: target, remaining, mode });
            // Zastavit: co už je rozhodnuté, se neprovede — nic se nezměnilo.
            if (answer === null) return 0;
            onConflict = answer.choice;
            if (answer.applyToAll) forAll = answer.choice;
          }
        }

        plan.push({ path, onConflict });
      }

      let skipped = 0;
      const done: { from: string; to: string }[] = [];
      /** Položky, kterým chybí oprávnění — nabídnou se jako správce. */
      const needAdmin: typeof plan = [];
      const label = mode === "copy" ? "op.copy" : "op.move";

      const { ok } = await runBatch(
        label,
        plan,
        async (item) => {
          const { path, onConflict } = item;
          let result: OpResult;
          try {
            result =
              mode === "copy"
                ? await copyPath(path, target, onConflict)
                : await movePath(path, target, onConflict);
          } catch (err: unknown) {
            if (!needsAdmin(err)) throw err;
            needAdmin.push(item);
            return;
          }
          if (result.skipped) return;

          if (mode === "copy") await storage.copyTags(path, result.path);
          else await storage.remapPath(path, result.path);
          skipped += result.skipped_links;
          // „Nahradit" přepsalo cizí položku — Zpět by ji nevrátil, jen by
          // smazal i tu novou. Taková operace do historie nepatří.
          if (onConflict !== "replace" && !storage.samePath(path, result.path)) {
            done.push({ from: path, to: result.path });
          }
        },
      );

      if (done.length > 0) record({ kind: mode === "copy" ? "copy" : "move", items: done });
      noteSkippedLinks(skipped);
      // Jako správce bez Zpět — vrácení by oprávnění potřebovalo znovu.
      if (needAdmin.length > 0) {
        askAdmin(
          needAdmin.map((item) => item.path),
          () =>
            void runOperation(label, async () => {
              const outcomes = await transferElevated(
                needAdmin.map(({ path, onConflict }) => ({ from: path, onConflict })),
                target,
                mode === "copy" ? "copy" : "move",
              );
              const failed: ItemFailure[] = [];
              for (const [index, outcome] of outcomes.entries()) {
                const from = needAdmin[index].path;
                if (outcome.failure) failed.push(outcome.failure);
                else if (outcome.result && !outcome.result.skipped) {
                  if (mode === "copy") await storage.copyTags(from, outcome.result.path);
                  else await storage.remapPath(from, outcome.result.path);
                }
              }
              reportFailures(label, failed, needAdmin.length);
            }),
        );
      }
      return ok - needAdmin.length;
    },
    [runBatch, noteSkippedLinks, askConflict, setNotice, record, askAdmin, runOperation, reportFailures],
  );

  /** Vloží do `into`, bez něj do složky, ve které uživatel stojí. */
  const paste = useCallback(
    (into?: string) => {
      const target = into ?? currentDir;
      if (target === null) return;

      void clipboardReadFiles()
        // Schránku drží jiná aplikace — poslouží interní kopie, když nějaká je.
        .catch(() => (clipboard ? { paths: clipboard.paths, cut: clipboard.mode === "cut" } : null))
        .then((files) => {
          // Text nebo obrázek: Vložit tu nemá co dělat, chyba to ale není.
          if (files === null || files.paths.length === 0) {
            setClipboard(null);
            return;
          }
          const { paths } = files;
          const mode = files.cut ? "cut" : "copy";

          // Vyjmuto a vloženo tam, kde už to leží — není co přesouvat, schránka pryč.
          const alreadyThere = paths.every((path) => {
            const parent = parentPath(path);
            return parent !== null && storage.samePath(parent, target);
          });

          return transfer(paths, target, mode).then((ok) => {
            // Vyjmuté položky se dají vložit jen jednou (jako v Průzkumníku).
            // Schránka se ale čistí jen když se aspoň něco přesunulo — po
            // úplném selhání by uživatel jinak přišel i o to, co měl vyjmuté.
            if (mode === "cut" && (ok > 0 || alreadyThere)) {
              setClipboard(null);
              setClipboardHasItems(false);
              clipboardClear().catch(() => undefined);
            }
          });
        })
        .catch((err: unknown) => setNotice(failure("op.paste", err), errorDetail(err)));
    },
    [clipboard, currentDir, transfer, setNotice],
  );

  /** F5 / F6 a kontextové menu: výběr aktivního panelu do složky druhého. */
  // Výsledky hledání a tag view nejsou složka — ani zdroj (výběr pod nimi je
  // neviditelný), ani cíl (jejich podkladová složka není vidět).
  const otherDir =
    otherPanel !== null &&
    otherPanel.search === null &&
    otherPanel.tagFilter === null &&
    !otherPanel.trashView &&
    search === null &&
    tagFilter === null &&
    !trashView
      ? otherPanel.currentDir
      : null;
  const transferToOther = useCallback(
    (mode: "copy" | "cut", items: FileEntry[] = targetEntries) => {
      if (otherDir === null || items.length === 0) return;
      transfer(
        items.map((entry) => entry.path),
        otherDir,
        mode,
      ).catch((err: unknown) => setNotice(failure(mode === "copy" ? "op.copy" : "op.move", err), errorDetail(err)));
    },
    [otherDir, targetEntries, transfer, setNotice],
  );

  /** Přetažení na složku: přesun, s Ctrl kopie. */
  const dropInto = useCallback(
    (folder: string, paths: string[], copy: boolean) => {
      transfer(paths, folder, copy ? "copy" : "cut").catch((err: unknown) =>
        setNotice(failure(copy ? "op.copy" : "op.move", err), errorDetail(err)),
      );
    },
    [transfer, setNotice],
  );

  return { checkClipboard, copyText, paste, copyToClipboard, otherDir, transferToOther, putOnClipboard, dropInto };
}
