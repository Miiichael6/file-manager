import { convertFileSrc } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { getStore } from "@tauri-apps/plugin-store";

import type { FileSystem, FileUrls, SettingsStore, ShellImages, TextClipboard } from "../domain/ports";
import type { FileEntry } from "../domain/types";
import { invoke } from "./fileops";
import * as storage from "./storage";

/** Adaptér FileSystem nad commandy main.rs. */
export const tauriFileSystem: FileSystem = {
  listDir: (path, showHidden) => invoke<FileEntry[]>("list_dir", { path, showHidden }),
};

export const tauriShellImages: ShellImages = {
  fileIcon: (path, size) => invoke<string>("get_file_icon", { path, size }),
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
