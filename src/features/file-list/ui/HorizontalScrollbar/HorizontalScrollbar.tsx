import { useEffect, useRef, useState } from "react";

import "../ColumnResizer/column-resizer.css";

/*
 * MI-FORK: barra de desplazamiento horizontal de la vista Lista. La nativa del
 * scroller queda pegada al borde inferior, debajo de la barra de estado de
 * cristal, y no se ve: esta se queda fija (sticky) en el borde visible del
 * scroller y se sincroniza con su scrollLeft en los dos sentidos. El sticky ya
 * cuenta desde el borde reducido por el padding del scroller (la barra de
 * estado), así que bottom: 0; con lista corta la empuja abajo margin-top: auto.
 */
export function HorizontalScrollbar({
  scrollRef,
  contentWidth,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  contentWidth: number | undefined;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    const scroller = scrollRef.current;
    const bar = barRef.current;
    if (!scroller || !bar) return;
    const observer = new ResizeObserver(() => setViewport(scroller.clientWidth));
    observer.observe(scroller);
    setViewport(scroller.clientWidth);
    // Comparar antes de asignar corta el eco entre los dos eventos scroll.
    const fromScroller = () => {
      if (bar.scrollLeft !== scroller.scrollLeft) bar.scrollLeft = scroller.scrollLeft;
    };
    const fromBar = () => {
      if (scroller.scrollLeft !== bar.scrollLeft) scroller.scrollLeft = bar.scrollLeft;
    };
    scroller.addEventListener("scroll", fromScroller, { passive: true });
    bar.addEventListener("scroll", fromBar, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", fromScroller);
      bar.removeEventListener("scroll", fromBar);
    };
  }, [scrollRef]);

  const overflows = contentWidth !== undefined && viewport > 0 && contentWidth > viewport;
  return (
    <div
      ref={barRef}
      aria-hidden
      className="mi-hscroll"
      style={{ width: viewport || undefined, display: overflows ? undefined : "none" }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>
  );
}
