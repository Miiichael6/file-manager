import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { invoke } from "../../../shared/infrastructure/fileops";
import type { WindowChrome } from "../domain/ports";

/** Adaptér WindowChrome nad oknem Tauri a commandy main.rs / snap.rs. */
export const tauriWindowChrome: WindowChrome = {
  systemTransparency: () => invoke<boolean>("system_transparency"),
  acrylicSupported: () => invoke<boolean>("acrylic_supported"),
  setBackdrop: (backdrop) => invoke("set_window_backdrop", { backdrop }),
  setBackgroundColor: (color) => getCurrentWindow().setBackgroundColor(color),
  isActive: () => invoke<boolean>("window_is_active"),
  onActiveChange: (handler) => listen<boolean>("window-active", ({ payload }) => handler(payload)),
  ready: () => invoke("app_ready"),
};
