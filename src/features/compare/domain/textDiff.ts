import type { DiffLine, DiffRow } from "./textDiff.types";

/*
 * MI-FORK: diff de texto por líneas para «Comparar» (CompareDialog). Algoritmo
 * de Myers (O(ND)) tras recortar el prefijo y el sufijo comunes. Si los
 * archivos difieren en más de MAX_EDITS líneas, el centro se da por cambiado
 * entero en vez de buscar el diff mínimo (sería lento y nadie lo leería).
 */

const MAX_EDITS = 2000;

export function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Secuencia de ediciones para pasar de `a` a `b` (números de línea desde 1). */
export function diffLines(a: string[], b: string[]): DiffLine[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) out.push({ type: "same", a: i + 1, b: i + 1, text: a[i] });
  middle(a, b, start, endA, start, endB, out);
  for (let i = endA, j = endB; i < a.length; i++, j++) out.push({ type: "same", a: i + 1, b: j + 1, text: a[i] });
  return out;
}

/** Myers sobre a[a0..a1) y b[b0..b1), guardando la frontera de cada paso. */
function middle(a: string[], b: string[], a0: number, a1: number, b0: number, b1: number, out: DiffLine[]) {
  const n = a1 - a0;
  const m = b1 - b0;
  const all = () => {
    for (let i = a0; i < a1; i++) out.push({ type: "del", a: i + 1, text: a[i] });
    for (let j = b0; j < b1; j++) out.push({ type: "add", b: j + 1, text: b[j] });
  };
  if (n === 0 || m === 0) return all();

  const max = Math.min(n + m, MAX_EDITS);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = -1;

  for (let d = 0; d <= max && found < 0; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[a0 + x] === b[b0 + y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found < 0) return all();

  // Camino hacia atrás por las fronteras guardadas.
  const steps: DiffLine[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const prev = trace[d];
    const k = x - y;
    const down = k === -d || (k !== d && prev[offset + k - 1] < prev[offset + k + 1]);
    const prevK = down ? k + 1 : k - 1;
    const prevX = prev[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
      steps.push({ type: "same", a: a0 + x + 1, b: b0 + y + 1, text: a[a0 + x] });
    }
    if (down) {
      y--;
      steps.push({ type: "add", b: b0 + y + 1, text: b[b0 + y] });
    } else {
      x--;
      steps.push({ type: "del", a: a0 + x + 1, text: a[a0 + x] });
    }
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    steps.push({ type: "same", a: a0 + x + 1, b: b0 + y + 1, text: a[a0 + x] });
  }
  for (let i = steps.length - 1; i >= 0; i--) out.push(steps[i]);
}

/** Pliega los tramos iguales largos, dejando `context` líneas junto a cada cambio. */
export function foldDiff(lines: DiffLine[], context = 3): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type !== "same") {
      rows.push(lines[i++]);
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j].type === "same") j++;
    const keepHead = i === 0 ? 0 : context;
    const keepTail = j === lines.length ? 0 : context;
    if (j - i > keepHead + keepTail + 1) {
      rows.push(...lines.slice(i, i + keepHead));
      rows.push({ type: "fold", count: j - i - keepHead - keepTail });
      rows.push(...lines.slice(j - keepTail, j));
    } else {
      rows.push(...lines.slice(i, j));
    }
    i = j;
  }
  return rows;
}
