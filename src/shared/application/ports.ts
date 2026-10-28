import type { FileSystem, FileUrls, SettingsStore, ShellImages, TextClipboard } from "../domain/ports";
import { definePort } from "./port";

export const fileSystem = definePort<FileSystem>("FileSystem");
export const shellImages = definePort<ShellImages>("ShellImages");
export const settingsStore = definePort<SettingsStore>("SettingsStore");
export const textClipboard = definePort<TextClipboard>("TextClipboard");
export const fileUrls = definePort<FileUrls>("FileUrls");
