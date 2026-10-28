import { invoke } from "../../../shared/infrastructure/fileops";
import type { FolderApp, FolderApps, ShellIntegration, ShellIntegrationState } from "../domain/ports";

/** Adaptér FolderApps nad commandy mi_fork.rs. */
export const tauriFolderApps: FolderApps = {
  detect: () => invoke<FolderApp[]>("folder_apps"),
  open: (app, path) => invoke<void>("open_folder_with", { app: app.path, path }),
  pick: (title, filter) => invoke<FolderApp | null>("pick_folder_app", { title, filter }),
};

/** Adaptér ShellIntegration nad commandy mi_cli.rs. */
export const tauriShellIntegration: ShellIntegration = {
  read: () => invoke<ShellIntegrationState>("shell_integration"),
  set: (kind, enabled, label) => invoke("set_shell_integration", { kind, enabled, label }),
};
