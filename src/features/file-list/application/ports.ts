import { definePort } from "../../../shared/application/port";
import type { ExplorerExtensions, FolderSizes, NativeDrag } from "../domain/ports";

export const explorerExtensions = definePort<ExplorerExtensions>("ExplorerExtensions");
export const folderSizes = definePort<FolderSizes>("FolderSizes");
export const nativeDrag = definePort<NativeDrag>("NativeDrag");
