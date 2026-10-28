import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HardDrive } from "lucide-react";

import { FolderIcon } from "../components/icons";
import { specialFolderGlyph } from "../lib/specialFolders";

/**
 * MI-FORK: duch složky tažené ze sidebaru — stejná karta jako u ouška
 * (.mi-tab-ghost). Jede za kurzorem z dragover (mimo React); nad sidebarem
 * se schová, tam tažení ukazují samy řádky (přerovnání, nová oblíbená).
 */
export function FolderDragGhost({ path, name }: { path: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const onDragOver = (event: DragEvent) => {
      const ghost = ref.current;
      if (!ghost) return;
      ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 10}px)`;
      const overSidebar = event.target instanceof Element && event.target.closest(".fw-sidebar") !== null;
      ghost.classList.toggle("is-shown", !overSidebar);
    };
    document.addEventListener("dragover", onDragOver, true);
    return () => document.removeEventListener("dragover", onDragOver, true);
  }, []);

  const isDrive = /^[a-z]:\\?$/i.test(path);
  return createPortal(
    <div ref={ref} className="mi-tab-ghost" aria-hidden>
      <div className="mi-tab-ghost-card">
        {isDrive ? (
          <HardDrive size={22} strokeWidth={1.75} className="m-[5px] shrink-0" />
        ) : (
          <FolderIcon size={32} glyph={specialFolderGlyph(path)} />
        )}
        <span className="truncate">{name}</span>
      </div>
    </div>,
    document.body,
  );
}
