import { joinPath, splitPath } from "./format";

/** Nadřazená složka, nebo null pro kořen disku či síťového share. */
export function parentPath(path: string): string | null {
  const { root, parts } = splitPath(path);
  if (parts.length === 0) return null;
  return joinPath(root, parts.slice(0, -1));
}

/**
 * Rodičovská složka relativně ke kořeni hledání — sloupec „Kde je" ve výsledcích.
 *
 * Prázdný řetězec znamená „přímo v prohledávané složce"; volající si za něj
 * dosadí vlastní popisek.
 */
export function relativeParent(path: string, root: string): string {
  const parent = parentPath(path);
  if (parent === null) return "";

  // Kořen může i nemusí končit lomítkem ("C:\" vs "C:\Users\jane").
  const base = root.endsWith("\\") ? root.slice(0, -1) : root;
  if (parent.toLowerCase() === base.toLowerCase()) return "";

  const prefix = `${base}\\`;
  return parent.toLowerCase().startsWith(prefix.toLowerCase())
    ? parent.slice(prefix.length)
    : parent;
}

/** Znaky, které Windows v názvu nepovoluje — stejná sada jako ve validate_name v Rustu. */
const INVALID_NAME = /[<>:"/\\|?*]/;

export function isValidFileName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && !INVALID_NAME.test(trimmed);
}

/**
 * Rozdělí název na část k editaci a příponu — Finder při přejmenování
 * předvybere jen tělo názvu, příponu nechává být.
 */
export function stemLength(name: string): number {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? dot : name.length;
}

/**
 * Jednotný klíč cesty: malá písmena, zpětná lomítka, bez lomítka na konci
 * (kromě kořene disku). Windows velikost písmen nerozlišuje — ručně zadané
 * "c:\users\…" musí najít tytéž tagy jako "C:\Users\…" z výpisu.
 */
export function pathKey(path: string): string {
  const key = path.replace(/\//g, "\\").toLowerCase();
  if (/^[a-z]:\\?$/.test(key)) return `${key.slice(0, 2)}\\`;
  return key.replace(/\\+$/, "");
}

export function samePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b);
}

/** "C:\\Users\\jane\\Downloads" → "Downloads"; kořen disku vrátí "C:". */
export function lastSegment(path: string): string {
  const parts = path.split("\\").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
