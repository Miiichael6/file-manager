/**
 * Souborové operace pro UI — fasáda nad porty FileOperations, FileClipboard,
 * RecycleBin a ShellLauncher. Drží logiku aplikace (slovo „kopie" v jazyce UI,
 * výchozí terminál z nastavení, cache jednou za běh); samotné volání backendu
 * je v adaptérech (shared/infrastructure/tauriFileOps.ts).
 */
import type { SearchRule } from "../../features/search/domain/searchCriteria.types";
import type {
  ClipboardFiles,
  DeleteReport,
  ElevatedOutcome,
  MediaInfo,
  OnConflict,
  RecycleEntry,
  RecycleState,
  ShellNewType,
  TerminalId,
} from "../domain/fileops";
import type { FileEntry, FileProperties, FolderStats, OpResult, StatResult } from "../domain/types";
import { t } from "../i18n/index";
import { getSnapshot } from "../infrastructure/storage";
import type { TerminalPreference } from "../infrastructure/storage.types";
import { BackendFailure } from "./errors";
import { fileClipboard, fileOperations, recycleBin, shellImages, shellLauncher } from "./ports";

export type { BackendError } from "../domain/backendError.types";
export type {
  ClipboardFiles,
  DeleteReport,
  ElevatedOutcome,
  ItemFailure,
  MediaInfo,
  OnConflict,
  RecycleEntry,
  RecycleState,
  ShellNewType,
  TerminalId,
} from "../domain/fileops";
export { isValidFileName, parentPath, relativeParent, stemLength } from "../domain/paths";
export { errorDetail, failureDetail, failureText, isCancelled, needsAdmin } from "./errors";

/* Při „ponechat obě" a duplikaci dostane kopie slovo v jazyce UI:
   „Foto (kopie).jpg" / „Photo (copy).jpg". */
const copyLabel = () => t("name.copySuffix");

export function renamePath(from: string, toName: string): Promise<string> {
  return fileOperations.get().rename(from, toName);
}

/** Celý výběr jednou operací shellu — do Koše, nebo trvale; `elevate` = jako správce (UAC). */
export function deletePaths(paths: string[], permanent: boolean, elevate = false): Promise<DeleteReport> {
  return fileOperations.get().delete(paths, permanent, elevate);
}

/** Do Koše, nebo chyba u první položky, která neprošla (Zpět / Znovu). */
export async function moveToTrash(paths: string[]): Promise<void> {
  const { failed } = await deletePaths(paths, false);
  if (failed.length > 0) throw new BackendFailure({ key: "error.atPath", args: { path: failed[0].path, reason: failed[0].error } });
}

/** Kopírování / přesun jako správce (UAC); kolize jako copyPath / movePath. */
export function transferElevated(
  items: { from: string; onConflict: OnConflict }[],
  toDir: string,
  mode: "copy" | "move",
): Promise<ElevatedOutcome[]> {
  return fileOperations.get().transferElevated(items, toDir, mode, copyLabel());
}

export function renameElevated(from: string, toName: string): Promise<string> {
  return fileOperations.get().renameElevated(from, toName);
}

export function createFolderElevated(dir: string, name: string): Promise<string> {
  return fileOperations.get().createFolderElevated(dir, name);
}

/** Zpět u smazání: vrátí položky z Koše (smazané v `deletedSince` a později). */
export function restoreFromTrash(paths: string[], deletedSince: number): Promise<void> {
  return fileOperations.get().restoreFromTrash(paths, deletedSince);
}

/** Smaže se některá z cest trvale? (Svazek bez Koše — flashka, síť.) */
export function trashIsPermanent(paths: string[]): Promise<boolean> {
  return fileOperations.get().trashIsPermanent(paths);
}

export function copyPath(from: string, toDir: string, onConflict: OnConflict = "rename"): Promise<OpResult> {
  return fileOperations.get().copy(from, toDir, onConflict, copyLabel());
}

export function movePath(from: string, toDir: string, onConflict: OnConflict = "rename"): Promise<OpResult> {
  return fileOperations.get().move(from, toDir, onConflict, copyLabel());
}

export function duplicatePath(path: string): Promise<OpResult> {
  return fileOperations.get().duplicate(path, copyLabel());
}

export function statPaths(paths: string[]): Promise<StatResult[]> {
  return fileOperations.get().stat(paths);
}

export function openInExplorer(path: string): Promise<void> {
  return shellLauncher.get().openInExplorer(path);
}

/** Systémový dialog „Otevřít v aplikaci". */
export function openWith(path: string): Promise<void> {
  return shellLauncher.get().openWith(path);
}

/** Terminál ve složce (u souboru v té jeho); bez `terminal` podle volby
 *  v menu Více → Terminál (podmenu Shift+klik ho určí). */
export function openTerminal(path: string, terminal?: TerminalPreference): Promise<void> {
  return shellLauncher.get().openTerminal(path, terminal ?? getSnapshot().terminal);
}

/** Nainstalované terminály — zjistí se jednou za běh aplikace. */
let terminalsOnce: Promise<TerminalId[]> | null = null;
export function availableTerminals(): Promise<TerminalId[]> {
  terminalsOnce ??= shellLauncher.get().availableTerminals().catch(() => {
    terminalsOnce = null;
    // Bez odpovědi nic nezašedit — spuštění případně ohlásí chybu samo.
    return ["windowsTerminal", "pwsh", "powershell", "cmd"] as TerminalId[];
  });
  return terminalsOnce;
}

/** Typy pro menu Nový — backend je načte jednou za běh. */
let shellNewOnce: Promise<ShellNewType[]> | null = null;
export function listShellNew(): Promise<ShellNewType[]> {
  shellNewOnce ??= fileOperations.get().shellNewTypes().catch(() => {
    shellNewOnce = null;
    return [];
  });
  return shellNewOnce;
}

/** Nový soubor typu `extension` jménem `name` (bez přípony); vrátí cestu. */
export function createShellNew(dir: string, extension: string, name: string): Promise<string> {
  return fileOperations.get().createShellNew(dir, extension, name);
}

/** Ikona typu podle přípony (data URL) — soubor nemusí existovat. */
export function getExtensionIcon(extension: string): Promise<string> {
  return shellImages.get().extensionIcon(extension);
}

/** Vytvoří složku a vrátí její cestu (název se při kolizi očísluje). */
export function createFolder(dir: string, name: string): Promise<string> {
  return fileOperations.get().createFolder(dir, name);
}

export function createFile(dir: string, name: string): Promise<string> {
  return fileOperations.get().createFile(dir, name);
}

/** Telefon nebo fotoaparát (shellová cesta) — prohlížet ho umí jen Průzkumník. */
export function openDevice(path: string): Promise<void> {
  return shellLauncher.get().openDevice(path);
}

export function getFileProperties(path: string): Promise<FileProperties> {
  return fileOperations.get().properties(path);
}

/** Velikost a počet položek složky; mezisoučty chodí do `onProgress`. */
export function folderStats(
  path: string,
  requestId: number,
  onProgress: (stats: FolderStats) => void,
): Promise<FolderStats> {
  return fileOperations.get().folderStats(path, requestId, onProgress);
}

export function cancelFolderStats(requestId: number): Promise<void> {
  return fileOperations.get().cancelFolderStats(requestId);
}

export function searchRecursive(
  root: string,
  query: string,
  maxResults: number,
  showHidden: boolean,
  searchId: number,
  /** Pravidla rozšířeného hledání; když jsou, `query` se nepoužije. */
  criteria: SearchRule[] | null = null,
): Promise<FileEntry[]> {
  return fileOperations.get().search(root, query, maxResults, showHidden, searchId, criteria);
}

/** Zastaví běžící hledání — backend by jinak prošel celý disk až do konce. */
export function cancelSearch(searchId: number): Promise<void> {
  return fileOperations.get().cancelSearch(searchId);
}

/* ---------------------------- systémová schránka ---------------------------- */

export function clipboardWriteFiles(paths: string[], cut: boolean): Promise<void> {
  return fileClipboard.get().writeFiles(paths, cut);
}

/** null = ve schránce nejsou soubory (text, obrázek, nic). */
export function clipboardReadFiles(): Promise<ClipboardFiles | null> {
  return fileClipboard.get().readFiles();
}

export function clipboardHasFiles(): Promise<boolean> {
  return fileClipboard.get().hasFiles();
}

export function clipboardClear(): Promise<void> {
  return fileClipboard.get().clear();
}

export function getMediaInfo(path: string): Promise<MediaInfo> {
  return fileOperations.get().mediaInfo(path);
}

/* ---------------------------------- Koš ---------------------------------- */

export function recycleBinState(): Promise<RecycleState> {
  return recycleBin.get().state();
}

export function listRecycleBin(): Promise<RecycleEntry[]> {
  return recycleBin.get().list();
}

/** Zpět na původní místo (to zná Koš, posílá se jen `id`); obsazené místo
 *  se nepřepisuje (skončí ve `failed`). */
export function restoreRecycled(items: RecycleEntry[], elevate = false): Promise<DeleteReport> {
  return recycleBin.get().restore(items.map((item) => item.id), elevate);
}

export function purgeRecycled(items: RecycleEntry[], elevate = false): Promise<DeleteReport> {
  return recycleBin.get().purge(items.map((item) => item.id), elevate);
}

export function emptyRecycleBin(): Promise<void> {
  return recycleBin.get().empty();
}
