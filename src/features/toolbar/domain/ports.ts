/** Editor nebo jiná aplikace, ve které jde otevřít složku. */
export type FolderApp = { name: string; path: string };

/** MI-FORK: «Abrir con ▸» pro složky (mi_fork.rs). */
export interface FolderApps {
  /** Editory nalezené na disku (VS Code, Cursor…). */
  detect(): Promise<FolderApp[]>;
  open(app: FolderApp, path: string): Promise<void>;
  /** Dialog pro výběr .exe; null = zrušeno. */
  pick(title: string, filter: string): Promise<FolderApp | null>;
}

/** Stav integrace s Windows (registr HKCU, mi_cli.rs). */
export type ShellIntegrationState = { path: boolean; contextMenu: boolean };
export type ShellIntegrationKind = keyof ShellIntegrationState;

export interface ShellIntegration {
  read(): Promise<ShellIntegrationState>;
  /** `label` = text položky v kontextovém menu Průzkumníku. */
  set(kind: ShellIntegrationKind, enabled: boolean, label: string): Promise<void>;
}
