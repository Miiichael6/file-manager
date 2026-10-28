import { useCallback, useState } from "react";

import type { CommandHandler } from "../../command-palette/domain/commands";
import type { MenuItem } from "../../../shared/ui/ContextMenu";
import { parentPath } from "../../../shared/infrastructure/fileops";
import { archives } from "./ports";
import { useT, type MessageKey } from "../../../shared/i18n/index";
import type { FileEntry } from "../../../shared/domain/types";
import type { UndoOp } from "../../history/application/undo";
import { BatchRenameDialog } from "../../batch-rename/ui/BatchRenameDialog";
import { renameAll, targetOf, type Preview, type Renamed } from "../../batch-rename/domain/batchRename";
import { CompareDialog } from "../../compare/ui/CompareDialog";
import { GROUP_BY, setExtrasSetting, useExtrasSettings, type GroupBy } from "./extrasSettings";

/*
 * MI-FORK: extras de PENDIENTES §8 para App — ZIP, renombrar varios, comparar
 * dos archivos, agrupar por y tamaño de carpetas. Igual que la integración de
 * Git: App solo engancha los comandos, las entradas de menú y `dialogs`.
 */

export type ExtrasCommandId = "batchRename" | "compareFiles" | "compressZip" | "extractZip";

type Options = {
  /** Selección (o la entrada bajo el ratón) del panel activo. */
  targets: FileEntry[];
  /** Todo lo que hay en la carpeta actual (choques al renombrar). */
  siblings: FileEntry[];
  runOperation: (label: MessageKey, action: () => Promise<unknown>) => Promise<void>;
  record: (op: UndoOp) => void;
  requestSelect: (dir: string, path: string) => void;
  showInfo: (text: string) => void;
};

const GROUP_LABEL: Record<GroupBy, MessageKey> = {
  none: "extras.groupBy.none",
  kind: "extras.groupBy.kind",
  date: "extras.groupBy.date",
  size: "extras.groupBy.size",
};

type SubmenuItem = Extract<MenuItem, { type: "submenu" }>;
/** Vale tanto en un menú como dentro de un submenú. */
type NestedSubmenu = { type: "submenu"; label: string; items: SubmenuItem["items"] };
type ActionItem = Extract<MenuItem, { type: "item" }>;

const isZip = (entry: FileEntry) => !entry.is_dir && entry.name.toLowerCase().endsWith(".zip");

/** Todos en la misma carpeta (ZIP y renombrado trabajan en una sola). */
function commonParent(entries: FileEntry[]): string | null {
  const dirs = new Set(entries.map((entry) => (parentPath(entry.path) ?? "").toLowerCase()));
  return entries.length > 0 && dirs.size === 1 ? parentPath(entries[0].path) : null;
}

function zipName(entries: FileEntry[]): string {
  const first = entries[0];
  const dot = first.name.lastIndexOf(".");
  const stem = first.is_dir || dot <= 0 ? first.name : first.name.slice(0, dot);
  return `${stem}.zip`;
}

export function useExtras({ targets, siblings, runOperation, record, requestSelect, showInfo }: Options) {
  const t = useT();
  const settings = useExtrasSettings();
  const [renaming, setRenaming] = useState<FileEntry[] | null>(null);
  const [comparing, setComparing] = useState<[string, string] | null>(null);

  const compress = useCallback(
    (entries: FileEntry[]) => {
      const dir = commonParent(entries);
      if (dir === null) return;
      void runOperation("extras.op.zip", async () => {
        showInfo(t("extras.zip.compressing"));
        const path = await archives.get().create(
          entries.map((e) => e.path),
          dir,
          zipName(entries),
        );
        requestSelect(dir, path);
        showInfo(t("extras.zip.done"));
      });
    },
    [runOperation, requestSelect, showInfo, t],
  );

  const extract = useCallback(
    (entry: FileEntry) => {
      const dir = parentPath(entry.path);
      if (dir === null) return;
      void runOperation("extras.op.unzip", async () => {
        showInfo(t("extras.zip.extracting"));
        const path = await archives.get().extract(entry.path);
        requestSelect(dir, path);
        showInfo(t("extras.zip.extracted"));
      });
    },
    [runOperation, requestSelect, showInfo, t],
  );

  const applyRename = useCallback(
    (previews: Preview[]) => {
      setRenaming(null);
      void runOperation("extras.op.batchRename", async () => {
        try {
          record({ kind: "renameMany", items: await renameAll(previews.map(targetOf)) });
        } catch (err: unknown) {
          // Lo que sí se renombró antes del fallo se puede deshacer igual.
          const partial = (err as { partial?: Renamed[] } | null)?.partial;
          if (partial) record({ kind: "renameMany", items: partial });
          throw err;
        }
      });
    },
    [runOperation, record],
  );

  const files = targets.filter((entry) => !entry.is_dir);
  const canRename = targets.length >= 2 && commonParent(targets) !== null;
  const canCompare = targets.length === 2 && files.length === 2;
  const canZip = commonParent(targets) !== null;
  const zipToExtract = targets.length === 1 && isZip(targets[0]) ? targets[0] : null;

  const handlers: Record<ExtrasCommandId, CommandHandler> = {
    batchRename: { run: () => canRename && setRenaming(targets), enabled: canRename },
    compareFiles: { run: () => canCompare && setComparing([files[0].path, files[1].path]), enabled: canCompare },
    compressZip: { run: () => compress(targets), enabled: canZip },
    extractZip: { run: () => zipToExtract && extract(zipToExtract), enabled: zipToExtract !== null },
  };

  /** Entradas del menú contextual de un elemento para estos destinos. */
  const menuItems = useCallback(
    (entries: FileEntry[]): MenuItem[] => {
      const items: MenuItem[] = [{ type: "separator" }];
      if (commonParent(entries) !== null) {
        items.push({ type: "item", label: t("extras.zip.compress"), onSelect: () => compress(entries) });
      }
      if (entries.length === 1 && isZip(entries[0])) {
        items.push({ type: "item", label: t("extras.zip.extract"), onSelect: () => extract(entries[0]) });
      }
      if (entries.length >= 2 && commonParent(entries) !== null) {
        items.push({ type: "item", label: t("extras.rename.menu"), onSelect: () => setRenaming(entries) });
      }
      if (entries.length === 2 && entries.every((entry) => !entry.is_dir)) {
        items.push({
          type: "item",
          label: t("extras.compare.menu"),
          onSelect: () => setComparing([entries[0].path, entries[1].path]),
        });
      }
      return items.length > 1 ? items : [];
    },
    [compress, extract, t],
  );

  /** Submenú «Agrupar por ▸» (menús de ordenar de la vista Lista). */
  const groupByMenu = useCallback(
    (): NestedSubmenu => ({
      type: "submenu",
      label: t("extras.groupBy.title"),
      items: GROUP_BY.map((groupBy) => ({
        type: "item" as const,
        label: t(GROUP_LABEL[groupBy]),
        checked: settings.groupBy === groupBy,
        onSelect: () => setExtrasSetting("groupBy", groupBy),
      })),
    }),
    [settings.groupBy, t],
  );

  /** Interruptor «Tamaño de carpetas» (submenú Ver). */
  const folderSizesItem = useCallback(
    (): ActionItem => ({
      type: "item",
      label: t("extras.folderSizes"),
      checked: settings.folderSizes,
      onSelect: () => setExtrasSetting("folderSizes", !settings.folderSizes),
    }),
    [settings.folderSizes, t],
  );

  const dialogs = (
    <>
      {renaming && (
        <BatchRenameDialog entries={renaming} siblings={siblings} onApply={applyRename} onClose={() => setRenaming(null)} />
      )}
      {comparing && <CompareDialog left={comparing[0]} right={comparing[1]} onClose={() => setComparing(null)} />}
    </>
  );

  return { handlers, menuItems, groupByMenu, folderSizesItem, dialogs };
}
