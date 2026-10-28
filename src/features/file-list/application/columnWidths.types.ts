export type ResizableColumn = "name" | "modified" | "size" | "kind";

export type ColumnWidths = { name: number | null } & Record<Exclude<ResizableColumn, "name">, number>;

export type Pane = 0 | 1;
