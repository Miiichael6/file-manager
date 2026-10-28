import { definePort } from "./port";
import type {
  DirWatcher,
  FileClipboard,
  FileOperations,
  FileSystem,
  FileUrls,
  SettingsStore,
  ShellImages,
  RecycleBin,
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
export const fileOperations = definePort<FileOperations>("FileOperations");
export const fileClipboard = definePort<FileClipboard>("FileClipboard");
export const recycleBin = definePort<RecycleBin>("RecycleBin");
