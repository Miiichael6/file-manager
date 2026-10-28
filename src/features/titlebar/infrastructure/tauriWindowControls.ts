import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { SnapButtonState, WindowControls } from "../domain/ports";

const appWindow = getCurrentWindow();

/** Adaptér WindowControls nad oknem Tauri a událostí snap-button (snap.rs). */
export const tauriWindowControls: WindowControls = {
  isMaximized: () => appWindow.isMaximized(),
  onResized: (handler) => appWindow.onResized(() => handler()),
  onSnapButton: (handler) => listen<SnapButtonState>("snap-button", ({ payload }) => handler(payload)),
  minimize: () => appWindow.minimize(),
  toggleMaximize: () => appWindow.toggleMaximize(),
  close: () => appWindow.close(),
};
