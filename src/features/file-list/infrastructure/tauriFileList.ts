import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { invoke } from "../../../shared/infrastructure/fileops";
import type { ExplorerExtensions, FolderSizes, FolderSizeUpdate, NativeDrag } from "../domain/ports";

/** Adaptér ExplorerExtensions nad extensions.rs. */
export const tauriExplorerExtensions: ExplorerExtensions = {
  hidesKnown: () => invoke<boolean>("explorer_hides_extensions"),
  rules: (extensions) => invoke<number[]>("extension_rules", { extensions }),
};

/** Adaptér FolderSizes nad mi_extras.rs (hodnoty přes Channel). */
export const tauriFolderSizes: FolderSizes = {
  compute: (paths, requestId, onSize) => {
    const channel = new Channel<FolderSizeUpdate>();
    channel.onmessage = onSize;
    return invoke("folder_sizes", { paths, requestId, onSize: channel });
  },
  cancel: (requestId) => invoke("cancel_folder_sizes", { requestId }),
};

/** Adaptér NativeDrag nad native_drag.rs a external_drop.rs. */
export const tauriNativeDrag: NativeDrag = {
  start: (paths) => invoke("start_native_drag", { paths }),
  onEnd: (handler) => listen("native-drag-end", () => handler()),
  onExternalDrop: (handler) => listen<{ id: number; paths: string[] }>("external-drop", ({ payload }) => handler(payload)),
};
