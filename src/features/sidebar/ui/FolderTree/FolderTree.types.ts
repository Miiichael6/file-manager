import type { TreeRow } from "../../application/folderTree.types";
import type { RefObject } from "react";
import type { FileEntry } from "../../../../shared/domain/types";

/** Fila que acaba de salir: se pinta un momento donde estaba, desvaneciéndose. */
export type Ghost = TreeRow & { index: number };

export type DropHandlers = {
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
};

export type FolderTreeProps = {
  root: string;
  rows: TreeRow[];
  highlightPath: string | null;
  scrollRef: RefObject<HTMLElement | null>;
  /** Clases de una fila del sidebar (aspecto, activo, destino de soltar). */
  rowClass: (active: boolean, dropTarget: boolean) => string;
  dropPath: string | null;
  dropProps: (path: string) => DropHandlers;
  onNavigate: (path: string) => void;
  onOpenTab: (path: string) => void;
  onOpenFile: (path: string, name: string) => void;
  onReveal: (path: string) => void;
  onContextMenu: (entry: FileEntry, x: number, y: number) => void;
  /** Tras cambiar las filas pintadas (la placa de selección se vuelve a medir). */
  onLayout: () => void;
};
