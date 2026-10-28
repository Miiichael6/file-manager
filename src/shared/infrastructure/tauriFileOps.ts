import { Channel } from "@tauri-apps/api/core";

import type { ClipboardFiles, DeleteReport, ElevatedOutcome, MediaInfo, RecycleEntry, RecycleState, ShellNewType } from "../domain/fileops";
import type { FileClipboard, FileOperations, RecycleBin } from "../domain/ports";
import type { FileEntry, FileProperties, FolderStats, OpResult, StatResult } from "../domain/types";
import { invoke } from "./fileops";

/* Tauri převádí snake_case parametry na camelCase, proto toName / toDir. */

/** Adaptér FileOperations nad main.rs a fileop.rs. */
export const tauriFileOperations: FileOperations = {
  rename: (from, toName) => invoke<string>("rename_path", { from, toName }),
  renameElevated: (from, toName) => invoke<string>("rename_elevated", { from, toName }),
  delete: (paths, permanent, elevate) => invoke<DeleteReport>("delete_paths", { paths, permanent, elevate }),
  copy: (from, toDir, onConflict, copyLabel) => invoke<OpResult>("copy_path", { from, toDir, onConflict, copyLabel }),
  move: (from, toDir, onConflict, copyLabel) => invoke<OpResult>("move_path", { from, toDir, onConflict, copyLabel }),
  duplicate: (path, copyLabel) => invoke<OpResult>("duplicate_path", { path, copyLabel }),
  transferElevated: (items, toDir, mode, copyLabel) =>
    invoke<ElevatedOutcome[]>("transfer_elevated", {
      items: items.map(({ from, onConflict }) => ({ from, on_conflict: onConflict })),
      toDir,
      mode,
      copyLabel,
    }),
  createFolder: (dir, name) => invoke<string>("create_folder", { dir, name }),
  createFolderElevated: (dir, name) => invoke<string>("create_folder_elevated", { dir, name }),
  createFile: (dir, name) => invoke<string>("create_file", { dir, name }),
  shellNewTypes: () => invoke<ShellNewType[]>("list_shell_new"),
  createShellNew: (dir, extension, name) => invoke<string>("create_shell_new", { dir, extension, name }),
  restoreFromTrash: (paths, deletedSince) => invoke<void>("restore_from_trash", { paths, deletedSince }),
  trashIsPermanent: (paths) => invoke<boolean>("trash_is_permanent", { paths }),
  stat: (paths) => invoke<StatResult[]>("stat_paths", { paths }),
  properties: (path) => invoke<FileProperties>("get_file_properties", { path }),
  mediaInfo: (path) => invoke<MediaInfo>("get_media_info", { path }),
  folderStats: (path, requestId, onProgress) => {
    const channel = new Channel<FolderStats>();
    channel.onmessage = onProgress;
    return invoke<FolderStats>("folder_stats", { path, requestId, onProgress: channel });
  },
  cancelFolderStats: (requestId) => invoke<void>("cancel_folder_stats", { requestId }),
  search: (root, query, maxResults, showHidden, searchId, criteria) =>
    invoke<FileEntry[]>("search_recursive", { root, query, maxResults, showHidden, searchId, criteria }),
  cancelSearch: (searchId) => invoke<void>("cancel_search", { searchId }),
};

/** Adaptér FileClipboard nad clipboard.rs. */
export const tauriFileClipboard: FileClipboard = {
  writeFiles: (paths, cut) => invoke<void>("clipboard_write_files", { paths, cut }),
  readFiles: () => invoke<ClipboardFiles | null>("clipboard_read_files"),
  hasFiles: () => invoke<boolean>("clipboard_has_files"),
  clear: () => invoke<void>("clipboard_clear"),
};

/** Adaptér RecycleBin nad recycle.rs. */
export const tauriRecycleBin: RecycleBin = {
  state: () => invoke<RecycleState>("recycle_bin_state"),
  list: () => invoke<RecycleEntry[]>("list_recycle_bin"),
  restore: (ids, elevate) => invoke<DeleteReport>("restore_recycled", { ids, elevate }),
  purge: (ids, elevate) => invoke<DeleteReport>("purge_recycled", { ids, elevate }),
  empty: () => invoke<void>("empty_recycle_bin"),
};
