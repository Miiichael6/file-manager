import type { FileEntry } from "../../../../shared/domain/types";

export type ConflictChoice = "replace" | "rename" | "skip";

export type ConflictAnswer = { choice: ConflictChoice; applyToAll: boolean };

export type ConflictRequest = {
  /** Položka, která se kopíruje / přesouvá. */
  source: FileEntry;
  /** Položka stejného jména, která už v cíli je. */
  existing: FileEntry;
  /** Cílová složka — jen pro text dialogu. */
  targetDir: string;
  /** Kolik dalších kolizí čeká po téhle (checkbox Použít pro všechny). */
  remaining: number;
  mode: "copy" | "cut";
};

export type ConflictDialogProps = ConflictRequest & {
  onAnswer: (answer: ConflictAnswer) => void;
  /** Zastavit celou operaci — zbytek položek se nezpracuje. */
  onCancel: () => void;
};
