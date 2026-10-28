export type DiffLine =
  | { type: "same"; a: number; b: number; text: string }
  | { type: "del"; a: number; text: string }
  | { type: "add"; b: number; text: string };

export type DiffRow = DiffLine | { type: "fold"; count: number };
