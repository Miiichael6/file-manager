/** Obsazení jednotky (bajty). */
export type DriveUsage = { path: string; total: number; free: number };

/** Údaje o jednotkách (mi_extras.rs). */
export interface Drives {
  usage(paths: string[]): Promise<DriveUsage[]>;
}
