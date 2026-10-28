import { formatSize } from "../format";
import { useFolderSize } from "./folderSizes";

/*
 * MI-FORK: piezas de la vista Lista para «Agrupar por» y el tamaño de las
 * carpetas (ListView solo las coloca).
 */

/** Cabecera de un grupo: nombre y número de elementos, a la altura de una fila. */
export function GroupHeaderRow({ label, count, top }: { label: string; count: number; top: number }) {
  return (
    <div
      className="mi-group-header absolute right-0 left-0 flex h-6 items-end gap-2 border-b border-line px-3 pb-0.5 text-[11px] font-semibold text-secondary"
      style={{ top: 0, transform: `translateY(${top}px)` }}
    >
      <span className="truncate">{label}</span>
      <span className="font-normal tabular-nums opacity-70">{count}</span>
    </div>
  );
}

/** Tamaño de una carpeta: vacío mientras no se sabe, atenuado con «…» mientras se calcula. */
export function FolderSizeCell({ path }: { path: string }) {
  const size = useFolderSize(path);
  return (
    <span className={`truncate text-right tabular-nums text-secondary ${size?.done ? "" : "opacity-60"}`}>
      {size ? `${formatSize(size.bytes, false)}${size.done ? "" : "…"}` : ""}
    </span>
  );
}
