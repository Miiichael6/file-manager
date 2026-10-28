import {
  DEFAULT_WIDTHS,
  getColumnWidths,
  saveColumnWidths,
  setColumnWidth,
  type Pane,
  type ResizableColumn,
} from "../../application/columnWidths";
import "./column-resizer.css";

/*
 * MI-FORK: tirador para cambiar el ancho de una columna de la vista Lista.
 * Va en el borde derecho de la columna `column` (en el hueco del grid): al
 * arrastrar, ese borde sigue al cursor y las columnas de la derecha se
 * desplazan, como en el Explorador. Las columnas que no son la última lo
 * llevan dentro de la celda siguiente (`edge="left"`, sobre el divisor).
 * Doble clic = ancho por defecto (Nombre vuelve a ser flexible). `pane` =
 * panel de la ventana dividida; cada uno tiene sus anchos.
 */
export function ColumnResizer({
  pane,
  column,
  edge,
}: {
  pane: Pane;
  column: ResizableColumn;
  edge: "left" | "right";
}) {
  return (
    <span
      aria-hidden
      className={`mi-col-resizer mi-col-resizer-${edge}`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setColumnWidth(pane, column, DEFAULT_WIDTHS[column]);
        saveColumnWidths(pane);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const handle = event.currentTarget;
        // Nombre flexible se fija en su ancho actual: si no, al ensanchar otra
        // columna se encogería Nombre y el borde no seguiría al cursor.
        if (getColumnWidths(pane).name === null) {
          const nameCell = handle.closest(".fw-list-header")?.children[1] as HTMLElement | undefined;
          if (nameCell) setColumnWidth(pane, "name", nameCell.offsetWidth);
        }
        const startX = event.clientX;
        const startWidth = getColumnWidths(pane)[column] ?? 0;
        handle.setPointerCapture(event.pointerId);
        document.documentElement.classList.add("mi-col-resizing");
        const move = (moveEvent: PointerEvent) => setColumnWidth(pane, column, startWidth + moveEvent.clientX - startX);
        const end = (endEvent: PointerEvent) => {
          // pointercancel no trae una posición fiable: se guarda lo último que se vio.
          if (endEvent.type === "pointerup") setColumnWidth(pane, column, startWidth + endEvent.clientX - startX);
          saveColumnWidths(pane);
          document.documentElement.classList.remove("mi-col-resizing");
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", end);
          handle.removeEventListener("pointercancel", end);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
      }}
    />
  );
}
