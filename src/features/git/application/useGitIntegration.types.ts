import type { FileEntry } from "../../../shared/domain/types";

export type GitCommandId = "gitPanel" | "gitStage" | "gitUnstage" | "gitPull" | "gitPush";

export type Options = {
  /** Složka aktivního panelu. */
  dir: string | null;
  /** Mění se s obsahem výpisu — změna na disku obnoví i stav gitu. */
  token: unknown;
  /** Vybrané položky (cíle příkazů Stage / Unstage). */
  targets: FileEntry[];
  setNotice: (text: string | null, detail?: string) => void;
  showInfo: (text: string) => void;
};
