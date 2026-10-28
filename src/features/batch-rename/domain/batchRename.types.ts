import type { FileEntry } from "../../../shared/domain/types";

export type ReplaceOptions = {
  mode: "replace";
  find: string;
  replace: string;
  regex: boolean;
  matchCase: boolean;
  /** También la extensión (si no, solo el nombre sin ella). */
  includeExt: boolean;
};

export type PatternOptions = {
  mode: "pattern";
  /** [name] = nombre sin extensión, [n] = número, [date] = fecha de modificación
   *  (corchetes y no llaves: en los textos de t() las llaves son parámetros). */
  pattern: string;
  start: number;
  /** Cifras mínimas del número (relleno con ceros). */
  pad: number;
};

export type RenameOptions = ReplaceOptions | PatternOptions;

export type Status = "same" | "ok" | "invalid" | "duplicate" | "exists" | "badRegex";

export type Preview = { entry: FileEntry; next: string; status: Status };

export type Renamed = { from: string; to: string };
