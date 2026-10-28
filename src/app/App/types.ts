import type { Panel } from "../../features/navigation/application/panel";
import type { FileEntry } from "../../shared/domain/types";

/** Jen funkce panelu (settery, navigace) — viz activeFns. */
export type PanelFunctions = {
  [K in keyof Panel as Panel[K] extends (...args: never[]) => unknown ? K : never]: Panel[K];
};

/**
 * Kontextové menu hlavního panelu. Pravý klik na položku a pravý klik na
 * volnou plochu nabízejí jiné věci, ale otevírají se stejnou komponentou.
 */
export type MainMenu =
  /** `overlay` = položka z výsledků hledání nebo z tag view. Leží mimo výpis
   *  aktuální složky, takže operace míří jen na ni a ne na výběr pod ní. */
  | { kind: "entry"; x: number; y: number; entry: FileEntry; overlay: boolean }
  | { kind: "background"; x: number; y: number; dir: string }
  | { kind: "status"; x: number; y: number; dir: string }
  | { kind: "quicklook"; x: number; y: number; entry: FileEntry }
  /** MI-FORK: ouško záložky. */
  | { kind: "tab"; x: number; y: number; id: number };
