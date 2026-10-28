import { convertFileSrc, invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { getStore } from "@tauri-apps/plugin-store";

import type {
  DirWatcher,
  FileSystem,
  FileUrls,
  SettingsStore,
  ShellImages,
  ShellLauncher,
  SystemPlaces,
  TextClipboard,
} from "../domain/ports";
import type { FavoriteSection, FileEntry } from "../domain/types";
import { invoke } from "./fileops";
import * as storage from "./storage";

type DirListing = { entries: FileEntry[]; more: boolean };
type DirChunk = { token: number; entries: FileEntry[]; done: boolean };

/** Adaptér FileSystem nad commandy main.rs. */
export const tauriFileSystem: FileSystem = {
  listDir: (path, showHidden) => invoke<FileEntry[]>("list_dir", { path, showHidden }),
  listDirStream: ({ path, showHidden, token, slot }, onBatch) => {
    // Dávky dir-chunk můžou předběhnout odpověď — posluchač se registruje první
    // a dávky před odpovědí čekají, aby pořadí sedělo.
    const pending: DirChunk[] = [];
    let listed = false;
    const unlisten = listen<DirChunk>("dir-chunk", ({ payload }) => {
      if (payload.token !== token) return;
      if (!listed) pending.push(payload);
      else onBatch(payload.entries, payload.done);
    });
    const finished = unlisten
      .then(() => invoke<DirListing>("list_dir_stream", { path, showHidden, token, slot }))
      .then((result) => {
        listed = true;
        onBatch(result.entries, !result.more);
        for (const chunk of pending) onBatch(chunk.entries, chunk.done);
      });
    return { finished, stop: () => void unlisten.then((stop) => stop()) };
  },
  diskFreeSpace: (path) => invoke<number>("get_disk_free_space", { path }),
  canList: (path) => invoke("can_list_dir", { path }),
  readText: (path, maxBytes) => invoke<{ text: string; truncated: boolean }>("read_text_file", { path, maxBytes }),
};

export const tauriShellImages: ShellImages = {
  fileIcon: (path, size) => invoke<string>("get_file_icon", { path, size }),
  // Surový invoke: chyba musí dorazit s klíčem (timeout se nepamatuje).
  thumbnail: (path, size) => tauriInvoke<string>("get_file_thumbnail", { path, size }),
};

const STORE_FILE = "settings.json";

// storage.init() už settings.json načetl; getStore vrátí tutéž instanci.
let loaded: ReturnType<typeof getStore> | null = null;
const store = () => (loaded ??= storage.init().then(() => getStore(STORE_FILE)));

/** Adaptér SettingsStore nad tauri-plugin-store (settings.json). */
export const tauriSettingsStore: SettingsStore = {
  read: (key) =>
    store()
      .then((s) => s?.get<unknown>(key))
      .catch(() => undefined),
  write: (key, value) =>
    store()
      .then((s) => s?.set(key, value))
      .catch(() => undefined),
};

export const tauriTextClipboard: TextClipboard = { writeText };

export const tauriFileUrls: FileUrls = { assetUrl: (path) => convertFileSrc(path) };

export const tauriShellLauncher: ShellLauncher = {
  open: (path) => invoke("open_file", { path }),
  openReleasePage: (url) => invoke("open_release_page", { url }),
};

export const tauriSystemPlaces: SystemPlaces = {
  favorites: () => invoke<FavoriteSection[]>("get_favorites"),
  onDrivesChanged: (handler) => listen("drives-changed", () => handler()),
  homeDir,
  explorerShowsHidden: () => invoke<boolean>("explorer_shows_hidden"),
};

export const tauriDirWatcher: DirWatcher = {
  watch: (paths, generation) => invoke("watch_dirs", { paths, generation }),
  onChange: (handler) => listen("dir-changed", () => handler()),
};
