import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { motionMs } from "../../../shared/lib/motion";
import type { SortKey } from "../../../shared/domain/format";
import type { ViewMode } from "../../../shared/domain/types";
import { useStableCallback } from "../../file-list/application/rowDnd";
import type { Panel } from "../../navigation/application/panel";
import { forgetTreeTab } from "../../sidebar/application/folderTree";
import { blankSnapshot, newTab, tabFace, type Tab, type TabSnapshot } from "./browser";

type Options = {
  tabs: Tab[];
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  activeTabId: number;
  setActiveTabId: Dispatch<SetStateAction<number>>;
  /** applyTab pro efekt startu, který běží dřív, než je funkce definovaná. */
  applyTabRef: MutableRefObject<(tab: Tab) => void>;
  panels: readonly [Panel, Panel];
  splitOn: boolean;
  setSplitOn: Dispatch<SetStateAction<boolean>>;
  activePanel: 0 | 1;
  setActivePanel: Dispatch<SetStateAction<0 | 1>>;
  setOverlayPreview: (value: null) => void;
  setQuickLookOpen: Dispatch<SetStateAction<boolean>>;
  viewMode: ViewMode;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
};

/** Operace nad záložkami: přepnutí, otevření, zavření, rozdělení, oddělení. */
export function useTabActions({
  tabs,
  setTabs,
  activeTabId,
  setActiveTabId,
  applyTabRef,
  panels,
  splitOn,
  setSplitOn,
  activePanel,
  setActivePanel,
  setOverlayPreview,
  setQuickLookOpen,
  viewMode,
  sortKey,
  sortDirection,
}: Options) {
  /** Stav celé aktivní záložky: oba panely, rozdělení a aktivní panel. */
  const captureTab = (): Pick<Tab, "snapshot" | "second" | "split" | "activePanel"> => ({
    snapshot: panels[0].captureSnapshot(),
    second: panels[1].captureSnapshot(),
    split: splitOn,
    activePanel,
  });

  /** Nahraje záložku do obou panelů. */
  const applyTab = (tab: Tab) => {
    panels[0].applySnapshot(tab.snapshot);
    panels[1].applySnapshot(tab.second ?? blankSnapshot(null));
    setSplitOn(tab.split === true);
    setActivePanel(tab.activePanel ?? 0);
    setOverlayPreview(null);
    setQuickLookOpen(false);
  };
  applyTabRef.current = applyTab;

  /** Otevřené záložky v pořadí lišty (bez těch, co právě odjíždějí). */
  const openTabs = tabs.filter((tab) => !tab.closing);

  const switchTab = useStableCallback((id: number) => {
    if (id === activeTabId) return;
    const target = openTabs.find((tab) => tab.id === id);
    if (!target) return;

    const captured = captureTab();
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, ...captured } : tab)));
    setActiveTabId(id);
    applyTab(target);
  });

  /** Nová záložka na konci lišty (jako ve Finderu), hned aktivní. */
  const openTab = useStableCallback((path: string | null, overlay?: Partial<TabSnapshot>) => {
    if (path === null) return;
    const base = newTab(path, { viewMode, sortKey, sortDirection });
    const tab = { ...base, snapshot: { ...base.snapshot, ...overlay }, fresh: true };
    const captured = captureTab();
    setTabs((current) => [
      ...current.map((item) => (item.id === activeTabId ? { ...item, ...captured } : item)),
      tab,
    ]);
    setActiveTabId(tab.id);
    applyTab(tab);
    // Příznak jen na dobu animace — jinak by ouško vjelo znovu při každém
    // dalším připojení lišty.
    window.setTimeout(
      () => setTabs((current) => current.map((item) => (item.id === tab.id ? { ...item, fresh: false } : item))),
      motionMs("--dur-nav") + 50,
    );
  });

  /** Poslední záložka se nezavírá — okno s jedinou záložkou zůstává. */
  const closeTab = useStableCallback((id: number) => {
    if (openTabs.length <= 1) return;
    const index = openTabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    forgetTreeTab(id); // MI-FORK

    if (id === activeTabId) {
      const neighbor = openTabs[index + 1] ?? openTabs[index - 1];
      setActiveTabId(neighbor.id);
      applyTab(neighbor);
    }
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, closing: true } : tab)));
    // Ouško se zúží a zhasne, pak teprve zmizí z pole.
    window.setTimeout(
      () => setTabs((current) => current.filter((tab) => tab.id !== id)),
      motionMs("--dur-nav"),
    );
  });

  const reorderTab = useCallback((id: number, index: number) => {
    setTabs((current) => {
      const from = current.findIndex((tab) => tab.id === id);
      if (from < 0 || from === index) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }, []);

  const splitWithTab = useStableCallback((id: number, side: 0 | 1) => {
    const dragged = openTabs.find((tab) => tab.id === id);
    if (!dragged || id === activeTabId) return;
    const incoming = tabFace(dragged);
    const leftovers: TabSnapshot[] = [];
    if (dragged.split && dragged.second) {
      leftovers.push(dragged.activePanel === 1 ? dragged.snapshot : dragged.second);
    }
    if (splitOn) {
      leftovers.push(panels[side].captureSnapshot());
    } else {
      // Dosavadní obsah okna přejde na druhou stranu.
      const current = panels[activePanel].captureSnapshot();
      if (activePanel !== (side === 0 ? 1 : 0)) panels[side === 0 ? 1 : 0].applySnapshot(current);
    }
    panels[side].applySnapshot(incoming);
    setSplitOn(true);
    setActivePanel(side);

    const replacements = leftovers.map((snapshot) => ({ ...newTab(null), snapshot }));
    if (replacements.length === 0) forgetTreeTab(id);
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      if (index < 0) return current;
      const next = [...current];
      next.splice(index, 1, ...replacements);
      return next;
    });
  });

  const openFolderAt = useStableCallback((path: string, zone: 0 | 1 | "tab") => {
    if (zone === "tab") {
      openTab(path);
      return;
    }
    if (splitOn) {
      panels[zone].navigate(path);
    } else {
      const current = panels[activePanel].captureSnapshot();
      const other = zone === 0 ? 1 : 0;
      if (activePanel !== other) panels[other].applySnapshot(current);
      panels[zone].applySnapshot(blankSnapshot(path, { viewMode, sortKey, sortDirection }));
      setSplitOn(true);
    }
    setActivePanel(zone);
  });

  /**
   * MI-FORK: rozdělená záložka se rozdělí na dvě — záložka si nechá aktivní
   * panel, druhý panel (s historií, zobrazením a řazením) se otevře jako
   * nová záložka hned za ní, na pozadí.
   */
  const separateTab = useStableCallback((id: number) => {
    const target = openTabs.find((tab) => tab.id === id);
    if (!target) return;
    let detached: TabSnapshot;
    if (id === activeTabId) {
      if (!splitOn) return;
      const keep = activePanel;
      const other = keep === 0 ? 1 : 0;
      detached = panels[other].captureSnapshot();
      // Zůstávající panel je vždy levý — uložení záložky bere levý panel.
      if (keep === 1) panels[0].applySnapshot(panels[1].captureSnapshot());
      panels[1].applySnapshot(blankSnapshot(null));
      setActivePanel(0);
      setSplitOn(false);
    } else {
      if (!target.split || !target.second) return;
      detached = target.activePanel === 1 ? target.snapshot : target.second;
      const face = tabFace(target);
      setTabs((current) =>
        current.map((tab) =>
          tab.id === id ? { ...tab, snapshot: face, second: undefined, split: false, activePanel: 0 } : tab,
        ),
      );
    }
    const created = { ...newTab(null), snapshot: detached, fresh: true };
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = [...current];
      next.splice(index < 0 ? next.length : index + 1, 0, created);
      return next;
    });
    window.setTimeout(
      () => setTabs((current) => current.map((item) => (item.id === created.id ? { ...item, fresh: false } : item))),
      motionMs("--dur-nav") + 50,
    );
  });

  /** MI-FORK: zavře všechny záložky kromě `id` (ta se stane aktivní). */
  const closeOtherTabs = useStableCallback((id: number) => {
    const keep = openTabs.find((tab) => tab.id === id);
    if (!keep || openTabs.length <= 1) return;
    if (id !== activeTabId) {
      setActiveTabId(id);
      applyTab(keep);
    }
    const closing = new Set(openTabs.filter((tab) => tab.id !== id).map((tab) => tab.id));
    for (const other of closing) forgetTreeTab(other);
    setTabs((current) => current.map((tab) => (closing.has(tab.id) ? { ...tab, closing: true } : tab)));
    window.setTimeout(
      () => setTabs((current) => current.filter((tab) => !closing.has(tab.id))),
      motionMs("--dur-nav"),
    );
  });

  /** Ctrl+Tab / Ctrl+Shift+Tab — dokola. */
  const cycleTab = useStableCallback((delta: number) => {
    const index = openTabs.findIndex((tab) => tab.id === activeTabId);
    if (index < 0 || openTabs.length < 2) return;
    switchTab(openTabs[(index + delta + openTabs.length) % openTabs.length].id);
  });

  /** Ctrl+1…8 přímo, Ctrl+9 poslední — jako v prohlížeči. */
  const switchToTabNumber = useStableCallback((number: number) => {
    const tab = number === 9 ? openTabs[openTabs.length - 1] : openTabs[number - 1];
    if (tab) switchTab(tab.id);
  });



  return {
    applyTab,
    openTabs,
    captureTab,
    switchTab,
    openTab,
    closeTab,
    reorderTab,
    splitWithTab,
    openFolderAt,
    separateTab,
    closeOtherTabs,
    cycleTab,
    switchToTabNumber,
  };
}
