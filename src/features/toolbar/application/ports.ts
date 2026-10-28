import { definePort } from "../../../shared/application/port";
import type { FolderApps, ShellIntegration } from "../domain/ports";

export const folderApps = definePort<FolderApps>("FolderApps");
export const shellIntegration = definePort<ShellIntegration>("ShellIntegration");
