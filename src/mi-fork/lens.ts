/*
 * MI-FORK: refracción de Liquid Glass (lente en los bordes).
 *
 * backdrop-filter con url(#filtro) + feDisplacementMap: el fondo bajo el
 * cristal se desplaza solo cerca del borde (en el centro el mapa es neutro,
 * 128/128), así que el contenido se «dobla» al pasar bajo la arista y el
 * medio queda plano. Un filtro no conoce la forma del elemento, por eso el
 * mapa se genera aquí para cada elemento con su tamaño y radio exactos
 * (ResizeObserver lo regenera si cambia, p. ej. la paleta al filtrar).
 *
 * El CSS lee la referencia del filtro en --lg-lens (liquid-glass.css).
 * WebView2 = Chromium, que sí aplica url() dentro de backdrop-filter.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * frame: el vidrio está en ::before con inset −1 px (menús, submenús).
 * self: el vidrio está en el propio elemento (paleta).
 * bottom / top: barra a lo ancho, lente solo en la arista inferior / superior.
 */
type Kind = "frame" | "self" | "bottom" | "top";

/** Qué elementos llevan lente. Orden: el primero que encaja gana. */
const TARGETS: [selector: string, kind: Kind][] = [
  [".fw-palette", "self"],
  [".fw-popover:not(.fw-tooltip)", "frame"],
  [".fw-main", "bottom"],
  [".fw-statusbar", "top"],
];

/** Ancho de la banda que refracta (px) y desplazamiento máximo (px). */
const BAND: Record<Kind, number> = { frame: 14, self: 18, bottom: 22, top: 9 };
const SHIFT: Record<Kind, number> = { frame: 14, self: 18, bottom: 26, top: 8 };

type Lens = { id: string; filter: SVGFilterElement; observer: ResizeObserver; key: string; frame: number };

const lenses = new Map<HTMLElement, Lens>();
let defs: SVGDefsElement | null = null;
let mutations: MutationObserver | null = null;
let counter = 0;

function ensureDefs(): SVGDefsElement {
  if (defs?.isConnected) return defs;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  defs = document.createElementNS(SVG_NS, "defs");
  svg.append(defs);
  document.body.append(svg);
  return defs;
}

/**
 * Perfil del canto: 1 en la arista, 0 al final de la banda. Curva de una
 * lente biconvexa (más pendiente cerca del borde), no lineal.
 */
function profile(distance: number, band: number): number {
  if (distance >= band) return 0;
  const t = 1 - Math.max(distance, 0) / band;
  return t * t * (3 - 2 * t) * t;
}

/** Mapa RG: R = desplazamiento horizontal, G = vertical; 128 = nada. */
function buildMap(kind: Kind, width: number, height: number, radius: number): string {
  const band = BAND[kind];
  const edgeOnly = kind === "bottom" || kind === "top";
  // Las barras solo dependen de y: basta una columna de 1 px estirada.
  const w = edgeOnly ? 1 : width;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(w, height);
  const data = image.data;
  const r = Math.min(radius, width / 2, height / 2);
  const halfW = width / 2;
  const halfH = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      let dx = 0;
      let dy = 0;
      if (edgeOnly) {
        const distance = kind === "bottom" ? height - (y + 0.5) : y + 0.5;
        // Muestrea hacia dentro: el contenido junto a la arista se estira.
        dy = (kind === "bottom" ? -1 : 1) * profile(distance, band);
      } else {
        // Distancia con signo a un rectángulo redondeado (SDF) y su normal.
        const px = x + 0.5 - halfW;
        const py = y + 0.5 - halfH;
        const qx = Math.abs(px) - (halfW - r);
        const qy = Math.abs(py) - (halfH - r);
        let nx: number;
        let ny: number;
        let sdf: number;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy);
          sdf = len - r;
          nx = qx / len;
          ny = qy / len;
        } else {
          sdf = Math.max(qx, qy) - r;
          nx = qx > qy ? 1 : 0;
          ny = qx > qy ? 0 : 1;
        }
        const strength = profile(-sdf, band);
        dx = -Math.sign(px) * nx * strength;
        dy = -Math.sign(py) * ny * strength;
      }
      const i = (y * w + x) * 4;
      data[i] = Math.round(128 + dx * 127);
      data[i + 1] = Math.round(128 + dy * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Caja del vidrio (px) y su radio, según dónde está la capa con blur. */
function measure(el: HTMLElement, kind: Kind): { w: number; h: number; r: number } {
  const style = getComputedStyle(el);
  const r = parseFloat(style.borderTopLeftRadius) || 0;
  switch (kind) {
    case "frame":
      return { w: el.offsetWidth + 2, h: el.offsetHeight + 2, r: r + 1 };
    case "bottom":
      return { w: el.clientWidth, h: parseFloat(getComputedStyle(el, "::before").height) || 0, r: 0 };
    default:
      return { w: el.offsetWidth, h: el.offsetHeight, r };
  }
}

function update(el: HTMLElement, kind: Kind, lens: Lens) {
  const { w, h, r } = measure(el, kind);
  if (w < 4 || h < 4) return;
  const key = `${w}x${h}r${r}`;
  if (key === lens.key) return;
  lens.key = key;

  const href = buildMap(kind, Math.round(w), Math.round(h), r);
  const image = document.createElementNS(SVG_NS, "feImage");
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", String(w));
  image.setAttribute("height", String(h));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("result", "map");
  image.setAttribute("href", href);
  const displace = document.createElementNS(SVG_NS, "feDisplacementMap");
  displace.setAttribute("in", "SourceGraphic");
  displace.setAttribute("in2", "map");
  // Desplazamiento = (canal/255 − 0,5) × scale: el canal al máximo da scale/2 = SHIFT.
  displace.setAttribute("scale", String(SHIFT[kind] * 2));
  displace.setAttribute("xChannelSelector", "R");
  displace.setAttribute("yChannelSelector", "G");
  lens.filter.replaceChildren(image, displace);
  // Nueva referencia: Chromium no siempre repinta si solo cambia el contenido del filtro.
  el.style.setProperty("--lg-lens", `url(#${lens.id})`);
}

function attach(el: HTMLElement, kind: Kind) {
  if (lenses.has(el)) return;
  const id = `mi-lg-${++counter}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = id;
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  ensureDefs().append(filter);

  const lens: Lens = { id, filter, key: "", frame: 0, observer: new ResizeObserver(() => schedule()) };
  function schedule() {
    cancelAnimationFrame(lens.frame);
    lens.frame = requestAnimationFrame(() => update(el, kind, lens));
  }
  lens.observer.observe(el);
  lenses.set(el, lens);
  schedule();
}

function detach(el: HTMLElement) {
  const lens = lenses.get(el);
  if (!lens) return;
  cancelAnimationFrame(lens.frame);
  lens.observer.disconnect();
  lens.filter.remove();
  el.style.removeProperty("--lg-lens");
  lenses.delete(el);
}

function scan(root: ParentNode) {
  for (const [selector, kind] of TARGETS) {
    if (root instanceof HTMLElement && root.matches(selector)) attach(root, kind);
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      if (!lenses.has(el)) attach(el, kind);
    }
  }
}

export function startLens() {
  if (mutations) return;
  scan(document.body);
  mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof HTMLElement) scan(node);
    }
    for (const el of lenses.keys()) if (!el.isConnected) detach(el);
  });
  mutations.observe(document.body, { childList: true, subtree: true });
}

export function stopLens() {
  mutations?.disconnect();
  mutations = null;
  for (const el of [...lenses.keys()]) detach(el);
}
