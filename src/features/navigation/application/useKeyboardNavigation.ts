import { useEffect } from "react";
import { isTypingTarget } from "../../../shared/lib/dom";
import { commandForKey } from "../../command-palette/domain/commands";
import { smoothIfAllowed } from "../../../shared/lib/motion";
import type { UseKeyboardNavigationOptions } from "./useKeyboardNavigation.types";
export function useKeyboardNavigation({
  modalOpen,
  switchToTabNumber,
  tagFilter,
  search,
  trashView,
  commandsRef,
  setQuery,
  activeEntry,
  setQuickLookOpen,
  viewMode,
  moveSelection,
  isColumnView,
  viewMetrics,
  selectIndex,
  visibleEntries,
  findByPrefix,
  setSelection,
  setActive,
  open,
}: UseKeyboardNavigationOptions) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Modal si klávesy obsluhuje sám. Platí to pro všechny, ne jen Quick Look:
      // pod otevřenými Vlastnostmi šel dřív stisknout Delete a smazat výběr,
      // který uživatel za dialogem ani neviděl.
      if (modalOpen) return;
      // Menu, která drží vlastní stav mimo App (Více v toolbaru, sidebar) —
      // pod nimi nesmí projít Delete, F2 ani Ctrl+V. Menu se pozná podle DOM.
      if (document.querySelector("[data-fw-menu]")) return;

      // Ctrl+1…8 záložka podle pořadí, Ctrl+9 poslední — jako v prohlížeči.
      // Podle fyzické klávesy: na české klávesnici jsou na číslicích háčky.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && /^Digit[1-9]$/.test(event.code)) {
        event.preventDefault();
        switchToTabNumber(Number(event.code.slice(5)));
        return;
      }

      // Zkratky příkazů z registru (commands.ts) — stejné jako v menu a paletě.
      const typing = isTypingTarget(event.target);
      // Tag view a výsledky hledání nemají výběr v hlavním panelu — příkazy nad
      // výběrem by mířily na položky podkladové složky, které uživatel nevidí
      // (nejnebezpečnější je Delete). Projdou jen ty s rozsahem „overlay".
      const overlayMode = tagFilter !== null || search !== null || trashView;
      const command = commandsRef.current
        ? commandForKey(commandsRef.current, event, { typing, overlay: overlayMode })
        : null;
      if (command) {
        event.preventDefault();
        command.run();
        return;
      }
      if (typing) return;

      // Escape ve výsledcích hledání je zavře (a tím zastaví běžící průchod
      // disku), i když fokus není v poli hledání.
      if (event.key === "Escape" && search !== null) {
        event.preventDefault();
        setQuery("");
        return;
      }
      if (overlayMode) return;

      const ctrl = event.ctrlKey || event.metaKey;
      // Ctrl/Alt + klávesa je vždy příkaz. Zakázaný (Ctrl+↑ v kořeni disku,
      // Ctrl+↓ bez výběru) nesmí propadnout do obyčejného pohybu výběru.
      if (ctrl || event.altKey) return;

      switch (event.key) {
        case " ":
          if (activeEntry && !activeEntry.is_dir) {
            event.preventDefault();
            setQuickLookOpen(true);
          }
          break;
        // Column view si šipky, Home/End a psaní obsluhuje sám na svém
        // kontejneru — tady jen Icon a List View.
        case "ArrowRight":
        case "ArrowLeft":
          // V seznamu vodorovný pohyb nemá kam jít.
          if (viewMode !== "icon") break;
          event.preventDefault();
          moveSelection(event.key === "ArrowRight" ? 1 : -1, event.shiftKey);
          break;
        case "ArrowDown":
        case "ArrowUp": {
          if (isColumnView) break;
          event.preventDefault();
          // V mřížce o celý řádek — počet sloupců podle skutečné šířky okna.
          const step = viewMode === "icon" ? viewMetrics().columns : 1;
          moveSelection(event.key === "ArrowDown" ? step : -step, event.shiftKey);
          break;
        }
        case "Home":
        case "End":
          if (isColumnView) break;
          event.preventDefault();
          selectIndex(event.key === "Home" ? 0 : visibleEntries.length - 1, event.shiftKey);
          break;
        case "PageDown":
        case "PageUp": {
          if (isColumnView) break;
          event.preventDefault();
          const { columns, rowsPerPage } = viewMetrics();
          const page = columns * rowsPerPage;
          moveSelection(event.key === "PageDown" ? page : -page, event.shiftKey, smoothIfAllowed());
          break;
        }
        default:
          // Type-ahead: písmena a číslice skáčou na položku (mezerník je Quick Look).
          if (isColumnView || ctrl || event.altKey || event.key.length !== 1 || event.key === " ") break;
          {
            const found = findByPrefix(event.key, visibleEntries);
            if (found) selectIndex(visibleEntries.indexOf(found), false);
          }
          break;
        case "Escape":
          // Zrušit výběr jako ve Finderu i Průzkumníku. Column view si Escape
          // obsluhuje sám (zruší výběr v zaměřeném sloupci).
          if (isColumnView) break;
          setSelection(new Set());
          setActive(null);
          break;
        case "Enter":
          // V column view má Enter vlastní obsluhu na jeho kontejneru.
          if (isColumnView) break;
          event.preventDefault();
          if (activeEntry) open(activeEntry);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    modalOpen,
    tagFilter,
    trashView,
    search,
    isColumnView,
    activeEntry,
    open,
    moveSelection,
    selectIndex,
    findByPrefix,
    visibleEntries,
    viewMode,
    viewMetrics,
    setQuery,
    setSelection,
    setActive,
    switchToTabNumber,
  ]);
}
