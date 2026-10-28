import { invoke } from "../../../shared/infrastructure/fileops";
import type { DriveUsage, Drives } from "../domain/ports";

/** Adaptér Drives nad commandem drive_usage. */
export const tauriDrives: Drives = {
  usage: (paths) => invoke<DriveUsage[]>("drive_usage", { paths }),
};
