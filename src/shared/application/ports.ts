import { definePort } from "./port";
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

/** Držáky sdílených portů; adaptéry dosazuje src/app/composition. */
export const fileSystem = definePort<FileSystem>("FileSystem");
export const shellImages = definePort<ShellImages>("ShellImages");
export const settingsStore = definePort<SettingsStore>("SettingsStore");
export const textClipboard = definePort<TextClipboard>("TextClipboard");
export const fileUrls = definePort<FileUrls>("FileUrls");
export const shellLauncher = definePort<ShellLauncher>("ShellLauncher");
export const dirWatcher = definePort<DirWatcher>("DirWatcher");
export const systemPlaces = definePort<SystemPlaces>("SystemPlaces");
