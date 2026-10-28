import { listen } from "@tauri-apps/api/event";

import { invoke } from "../../../shared/infrastructure/fileops";
import type { JumpList, Launch } from "../domain/ports";

/** Adaptér JumpList nad commandy mi_fork.rs / mi_cli.rs. */
export const tauriJumpList: JumpList = {
  set: (category, paths) => invoke("set_jump_list", { category, paths }),
  onOpenFolder: (handler) => listen<Launch>("mi-open-folder", ({ payload }) => handler(payload)),
  startupLaunch: () => invoke<Launch | null>("startup_launch"),
};
