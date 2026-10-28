import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FolderOpen, Monitor, PanelLeft, PanelRight, Plus, Search, SearchX, Trash2, X } from "lucide-react";

import { ColumnView, InfoPanel } from "../../features/column-view/ui/ColumnView";
import {
  ConflictDialog,
  type ConflictAnswer,
  type ConflictRequest,
} from "../../features/dialogs/ui/ConflictDialog";
import { ConfirmDialog, type ConfirmRequest } from "../../features/dialogs/ui/ConfirmDialog";
import { ContextMenu, type MenuItem } from "../../shared/ui/ContextMenu";
import { EmptyState } from "../../shared/ui/EmptyState";
import { AboutDialog } from "../../features/dialogs/ui/AboutDialog";
import { PropertiesDialog } from "../../features/dialogs/ui/PropertiesDialog";
import { IconView } from "../../features/file-list/ui/IconView";
import { ListView } from "../../features/file-list/ui/ListView";
import { QuickLook } from "../../features/preview/ui/QuickLook";
// MI-FORK: Git integrado.
import { GitDialog } from "../../features/git/ui/GitDialog";
import { useExtras } from "../../features/extras/application/useExtras"; // MI-FORK
import { useGitIntegration } from "../../features/git/application/useGitIntegration";
import { SearchCriteriaBar, type SearchLocation } from "../../features/search/ui/SearchCriteriaBar";
import { SearchView } from "../../features/search/ui/SearchView";
import { Sidebar } from "../../features/sidebar/ui/Sidebar";
import { QuickBar, StatusBar } from "../../features/status-bar/ui/StatusBar";
import { TAB_MIME, TabBar, tabTitle } from "../../features/tabs/ui/TabBar";
import { TagView } from "../../features/tags/ui/TagView";
import { RecycleBinView } from "../../features/recycle-bin/ui/RecycleBinView";
import { ComputerView } from "../../features/drives/ui/ComputerView"; // MI-FORK
import { FolderIcon, folderDisplayName, sidebarIcon, sidebarIconColor, sidebarLabel } from "../../shared/ui/icons";
import { TitleBar } from "../../features/titlebar/ui/TitleBar";
import { Toolbar } from "../../features/toolbar/ui/Toolbar";
import { CommandPalette, type PaletteAction, type PaletteFolder } from "../../features/command-palette/ui/CommandPalette";
import { buildCommands } from "../../features/command-palette/domain/commands";
import type { Commands } from "../../features/command-palette/domain/commands.types";
import { TooltipLayer } from "../../shared/ui/Tooltip";
import { Skeleton, ViewTransition } from "../../shared/ui/ViewTransition";
import {
  createFile,
  createFolder,
  createShellNew,
  getExtensionIcon,
  listShellNew,
  duplicatePath,
  deletePaths,
  errorDetail,
  failureDetail,
  failureText,
  isCancelled,
  needsAdmin,
  renameElevated,
  createFolderElevated,
  transferElevated,
  type ItemFailure,
  openInExplorer,
  availableTerminals,
  openTerminal,
  parentPath,
  renamePath,
  statPaths,
  trashIsPermanent,
  type ShellNewType,
  type TerminalId,
} from "../../shared/application/fileops";
import {
  breadcrumbs,
} from "../../shared/domain/format";
import { errorText, failure, languageSetting, t, useLocale } from "../../shared/i18n/index";
import type { MessageKey } from "../../shared/i18n/index.types";
import { dirWatcher, fileSystem, shellLauncher, systemPlaces } from "../../shared/application/ports";
import { nativeDrag } from "../../features/file-list/application/ports";
import { canDropInto, draggedFolder, droppedPaths, endDrag, getDrag, isExternalFileDrag, useDrag } from "../../features/file-list/application/dnd";
import { isTypingTarget } from "../../shared/lib/dom";
import { GLASS_STATUS, GLASS_TOP, GLASS_UPDATE_BAR, GLASS_QUICK, GlassInsetsContext } from "../../features/theme/application/glass";
import type { GlassInsets } from "../../features/theme/application/glass.types";
import { refreshExplorerExtensions, useDisplayNames } from "../../features/file-list/application/extensions";
import { applyMotion } from "../../shared/lib/motion";
import * as storage from "../../shared/infrastructure/storage";
import { useFolderApps } from "../../features/toolbar/application/folderApps";
import { FolderOpenButton } from "../../features/toolbar/ui/FolderOpenButton"; // MI-FORK
import { GitToolbarButtons } from "../../features/toolbar/ui/GitToolbarButtons"; // MI-FORK
import { TerminalButton } from "../../features/toolbar/ui/TerminalButton"; // MI-FORK
import { useJumpList, type Launch } from "../../features/navigation/application/jumpList"; // MI-FORK
import { setTreeTabOrder } from "../../features/sidebar/application/folderTree"; // MI-FORK: árbol por pestaña
import { TAG_HEX, tagLabel } from "../../features/tags/application/tags";
import { useStableCallback } from "../../features/file-list/application/rowDnd";
import { FolderDragGhost } from "../../features/file-list/ui/FolderDragGhost";
import { usePanel } from "../../features/navigation/application/panel";
import type { Panel } from "../../features/navigation/application/panel.types";

import { useClipboardTransfer } from "../../features/file-list/application/useClipboardTransfer";
import { useKeyboardNavigation } from "../../features/navigation/application/useKeyboardNavigation";
import { buildToolbarSortItems } from "./menus/buildToolbarSortItems";
import { buildToolbarShareItems } from "./menus/buildToolbarShareItems";
import { buildToolbarTagItems } from "./menus/buildToolbarTagItems";
import { buildContextMenuItems } from "./menus/buildContextMenuItems";
import { useRecycleBin } from "../../features/recycle-bin/application/useRecycleBin";
import { useTabActions } from "../../features/tabs/application/useTabActions";
import { useNotice } from "../../features/notifications/application/useNotice";
import { Toast } from "../../features/notifications/ui/Toast";
import { SPLIT_MIN_WIDTH, TERMINAL_LABELS } from "./constants";
import { folderEntry, strengthCommand } from "./helpers";
import { Placeholder } from "./Placeholder";
import type { MainMenu, PanelFunctions } from "./types";
import { setSpecialFolders } from "../../features/sidebar/domain/specialFolders";
import { checkForUpdate } from "../../features/updates/infrastructure/updates";
import type { AvailableUpdate } from "../../features/updates/infrastructure/updates.types";
import { useStorage } from "../../shared/lib/useStorage";
import { blankSnapshot, newTab, tabFace } from "../../features/tabs/application/browser";
import type { Tab, TabSnapshot } from "../../features/tabs/application/browser.types";
import { useWindowAppearance } from "../../features/theme/application/useWindowAppearance";
import { redoOp, trashTimestamp, undoLabel, undoOp, UNDO_LIMIT } from "../../features/history/application/undo";
import type { UndoOp } from "../../features/history/application/undo.types";
import type {
  Clipboard,
  FavoriteSection,
  FileEntry,
  OpResult,
  StatResult,
  TagColor,
} from "../../shared/domain/types";

export default function App() {
  const names = useDisplayNames();
  const [windowFocused, setWindowFocused] = useState(true);
  /** Fokus okna — panely si z něj odvodí vlastní (neaktivní panel je „bez fokusu"). */
  const windowFocusedAll = windowFocused;

  const [sections, setSectionsState] = useState<FavoriteSection[]>([]);
  /** Sekce sidebaru — a z Oblíbených se odvodí speciální složky s glyfem. */
  const setSections = useCallback((next: FavoriteSection[]) => {
    setSpecialFolders(next);
    setSectionsState(next);
  }, []);

  /** Záložky. Živý stav (browser výš) má jen aktivní, ostatní leží jako snímky. */
  const [initialTab] = useState(() => newTab(null));
  const [tabs, setTabs] = useState<Tab[]>(() => [initialTab]);
  const [activeTabId, setActiveTabId] = useState(initialTab.id);
  /** applyTab pro efekt startu, který běží dřív, než je funkce definovaná. */
  const applyTabRef = useRef<(tab: Tab) => void>(() => undefined);
  /** Záložky se do nastavení zapisují až po jejich obnovení při startu. */
  const tabsLoaded = useRef(false);

  const { notice, expanded: noticeExpanded, closing: noticeClosing, setNotice, showInfo, close: closeNotice, toggleExpanded: toggleNoticeDetail } = useNotice();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  /** Otevřený dialog kolize a funkce, která vrátí odpověď čekající operaci. */
  const [conflict, setConflict] = useState<{
    request: ConflictRequest;
    resolve: (answer: ConflictAnswer | null) => void;
  } | null>(null);

  /** Zeptá se na kolizi; null = uživatel operaci zastavil. */
  const askConflict = useCallback(
    (request: ConflictRequest) =>
      new Promise<ConflictAnswer | null>((resolve) => setConflict({ request, resolve })),
    [],
  );
  /** Menu z toolbaru (Seřadit / Sdílet / Štítky / Více) — drží ho Toolbar. */
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);

  /** Kopie systémové schránky — jen pro průhlednost vyjmutých položek.
   *  Vkládá se vždy z té skutečné (Ctrl+V čte schránku Windows). */
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  /** Má systémová schránka soubory? Zjišťuje se při otevření menu (Vložit). */
  const [clipboardHasItems, setClipboardHasItems] = useState(false);
  const [menu, setMenu] = useState<MainMenu | null>(null);
  const [propertiesFor, setPropertiesFor] = useState<FileEntry | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  /** Paleta příkazů (Ctrl+K). */
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Registr příkazů z posledního renderu — pro handler kláves. */
  const commandsRef = useRef<Commands | null>(null);

  const {
    tags,
    favorites,
    recents,
    motion,
    extensionMode,
    updates,
    splitRatio,
    language,
    commandUsage,
    theme: themePreference,
    terminal,
    windowTransparency,
    transparencyStrength,
  } = useStorage();
  const folderApps = useFolderApps(); // MI-FORK
  // Překreslení po přepnutí jazyka; texty se berou z `t`, které čte aktuální locale.
  const locale = useLocale();
  useEffect(() => applyMotion(motion), [motion]);
  const { theme, changeTheme, toggleTheme, ready, acrylicAvailable } = useWindowAppearance({
    themePreference,
    windowTransparency,
    transparencyStrength,
  });

  // Nainstalované terminály: menu Více → Terminál zbylé zašedí, Shift+klik
  // na „Otevřít v terminálu" nabídne jen tyhle.
  const [terminals, setTerminals] = useState<TerminalId[] | null>(null);
  useEffect(() => {
    void availableTerminals().then(setTerminals);
  }, []);
  const hasTerminal = (id: TerminalId) => terminals === null || terminals.includes(id);

  // Typy z nabídky Průzkumníku Nový ▸ a jejich ikony (data URL podle přípony).
  const [shellNewTypes, setShellNewTypes] = useState<ShellNewType[]>([]);
  const [typeIcons, setTypeIcons] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void listShellNew().then((types) => {
      if (!alive) return;
      setShellNewTypes(types);
      for (const extension of [".txt", ...types.map((type) => type.extension)]) {
        getExtensionIcon(extension)
          .then((icon) => alive && setTypeIcons((current) => ({ ...current, [extension]: icon })))
          // Bez ikony zůstane položka jen s textem.
          .catch(() => undefined);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  /** Zvýšením se otevře menu Nový v toolbaru (příkaz newItem). */
  const [newMenuRequest, setNewMenuRequest] = useState(0);

  const [quickLookOpen, setQuickLookOpen] = useState(false);
  /** MI-FORK: panel informací vpravo (ⓘ v liště rychlých přepínačů). */
  const [infoOpen, setInfoOpen] = useState(false);
  /** Panel po zavření ještě dojede animací, teprve pak zmizí z DOM. */
  const [infoClosing, setInfoClosing] = useState(false);
  const toggleInfo = useCallback(() => {
    setInfoClosing(infoOpen);
    setInfoOpen(!infoOpen);
  }, [infoOpen]);
  /** Přepínač skrytých souborů. null = ještě se neví (čeká se na settings.json
   *  a případně na nastavení Průzkumníku) — výpis se do té doby nenačítá. */
  const [showHidden, setShowHidden] = useState<boolean | null>(null);

  /* ---------------------------- dva panely ------------------------------- */

  /** Rozdělené okno zapnuté uživatelem (Ctrl+Shift+D). */
  const [splitOn, setSplitOn] = useState(false);
  /** Panel, na který míří klávesnice, toolbar, status bar i sidebar. */
  const [activePanel, setActivePanel] = useState<0 | 1>(0);
  /** Úzké okno — rozdělení se schová a po zvětšení vrátí. */
  const [narrow, setNarrow] = useState(() => window.innerWidth < SPLIT_MIN_WIDTH);
  const splitVisible = splitOn && !narrow;

  const panels = [
    usePanel({ slot: 0, showHidden, setNotice }),
    usePanel({ slot: 1, showHidden, setNotice }),
  ] as const;
  /** Aktivní panel — zbytek App pracuje s ním (jména jako dřív). */
  const panel = panels[activePanel];
  const otherPanel = splitVisible ? panels[activePanel === 0 ? 1 : 0] : null;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  /** Panely, které jsou vidět (bez rozdělení jen aktivní). */
  const visiblePanels: (0 | 1)[] = splitVisible ? [0, 1] : [activePanel];
  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  /**
   * Funkce aktivního panelu se stabilní identitou, které vždy zavolají ten
   * panel, který je aktivní právě teď. Settery a callbacky jsou totiž pro
   * každý panel jiné — memoizovaný callback v App by jinak po přepnutí panelu
   * dál ovládal ten původní (pravý klik by měnil výběr v druhém panelu).
   */
  const activeFns = useMemo(() => {
    const proxies: Record<string, (...args: unknown[]) => unknown> = {};
    for (const [key, value] of Object.entries(panelRef.current)) {
      if (typeof value !== "function") continue;
      proxies[key] = (...args: unknown[]) =>
        (panelRef.current as unknown as Record<string, (...args: unknown[]) => unknown>)[key](...args);
    }
    return proxies as unknown as PanelFunctions;
  }, []);
  const {
    dispatch,
    setSortKey,
    setSortDirection,
    setQuery,
    setTagFilter,
    setTrashView,
    setComputerView,
    setSearch,
    setActive,
    setSelection,
    setError,
    setRenamingPath,
    setPathEditing,
    setOverlaySelected,
    navigate,
    goBack,
    goForward,
    submitSearch,
    openAdvancedSearch,
    selectEntry,
    viewMetrics,
    selectIndex,
    moveSelection,
    findByPrefix,
    requestSelect,
    reveal,
    goToParent,
    selectAll,
    changeViewMode,
  } = activeFns;
  const {
    nav,
    viewMode,
    sortKey,
    sortDirection,
    query,
    tagFilter,
    trashView,
    computerView,
    search,
    streamingCount,
    freeSpace,
    pathEditing,
    tagCount,
    searchCount,
    filterQuery,
    overlaySelected,
    columnsApi,
    sortedEntries,
    visibleEntries,
    focusedColumn,
    columnSelected,
    isColumnView,
    currentDir,
    targetEntries,
    activeEntry,
  } = panel;

  // MI-FORK: Git integrado.
  const git = useGitIntegration({ dir: currentDir, token: sortedEntries, targets: targetEntries, setNotice, showInfo });

  /** Klik do panelu ho aktivuje hned — ještě než dojde na výběr, menu nebo
   *  tažení, které tak už míří na něj. */
  const activatePanel = useCallback(
    (index: 0 | 1) => {
      if (index === activePanel) return;
      flushSync(() => setActivePanel(index));
    },
    [activePanel],
  );

  // Fokus nesmí zůstat v neaktivním panelu (sloupce si ho drží na svém
  // kontejneru) — šipky by jinak ovládaly jiný panel než Delete a Ctrl+C.
  // Aktivní sloupcový panel si ho po „probuzení" vezme sám.
  useEffect(() => {
    const focused = document.activeElement;
    const owner = focused instanceof Element ? focused.closest(".fw-panel") : null;
    if (owner && !owner.classList.contains("is-active") && focused instanceof HTMLElement) focused.blur();
  }, [activePanel]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < SPLIT_MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** Zapne / vypne rozdělení. Prázdný druhý panel začne ve stejné složce. */
  const toggleSplit = useCallback(() => {
    const current = panelRef.current;
    const other = panelsRef.current[activePanel === 0 ? 1 : 0];
    if (splitOn) {
      // MI-FORK: el otro panel no se pierde — si muestra otra carpeta, pasa a
      // su propia pestaña (como «Separar pestañas»); si es la misma, solo se cierra.
      const otherDir = other.nav.current;
      if (otherDir !== null && (current.currentDir === null || !storage.samePath(otherDir, current.currentDir))) {
        separateTab(activeTabId);
        return;
      }
      setSplitOn(false);
      return;
    }
    if (other.nav.current === null && current.currentDir !== null) {
      other.applySnapshot(
        blankSnapshot(current.currentDir, {
          viewMode: current.viewMode,
          sortKey: current.sortKey,
          sortDirection: current.sortDirection,
        }),
      );
    }
    setSplitOn(true);
    // MI-FORK: separateTab es estable (useStableCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitOn, activePanel, activeTabId]);

  /**
   * Dělicí čára. Během tažení se mění jen styl levého panelu (jednou za
   * snímek) — přes úložiště by každý pohyb myši překreslil celou aplikaci.
   * Do nastavení až na konci; konec je i ztráta myši (Alt+Tab během tažení).
   */
  const panelsBoxRef = useRef<HTMLDivElement>(null);
  const startSplitResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const box = panelsBoxRef.current?.getBoundingClientRect();
    const left = panelsBoxRef.current?.querySelector<HTMLElement>(":scope > .fw-panel");
    if (!box || !left) return;
    handle.setPointerCapture(event.pointerId);
    let ratio = splitRatio;
    let frame = 0;
    const onMove = (move: PointerEvent) => {
      ratio = storage.clampSplitRatio((move.clientX - box.left) / box.width);
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        left.style.flexBasis = `${ratio * 100}%`;
      });
    };
    const finish = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      handle.removeEventListener("lostpointercapture", finish);
      cancelAnimationFrame(frame);
      document.body.style.cursor = "";
      void storage.setSplitRatio(ratio);
    };
    document.body.style.cursor = "col-resize";
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", finish);
  };

  /** Po operaci se přenačtou viditelné panely — kopie mezi nimi mění oba.
   *  Skrytý panel nikdo nevidí ani nehlídá; obnoví se, až se ukáže. */
  const visibleRef = useRef(visiblePanels);
  visibleRef.current = visiblePanels;
  const refresh = useCallback(() => {
    for (const index of visibleRef.current) panelsRef.current[index].refresh();
  }, []);
  const secondShown = splitVisible;
  useEffect(() => {
    if (secondShown) panelsRef.current[activePanel === 0 ? 1 : 0].refresh();
    // Jen při zobrazení druhého panelu, ne při každém přepnutí aktivního.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondShown]);
  /** Náhled položky z výsledků hledání nebo z tag view — ty nejsou ve výpisu
   *  složky, takže běžný Quick Look nad `activeEntry` je neuvidí. */
  const [overlayPreview, setOverlayPreview] = useState<FileEntry | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Persistentní nastavení se načte jednou; do té doby jedou sekce prázdné.
  // Přepínač skrytých souborů bere uloženou volbu, a dokud si ho uživatel
  // nezměnil sám, platí to, co má nastavené Průzkumník.
  useEffect(() => {
    void storage.init().then(() => {
      const saved = storage.getSnapshot().showHidden;
      if (saved !== null) {
        setShowHidden(saved);
        return;
      }
      systemPlaces
        .get()
        .explorerShowsHidden()
        .then(setShowHidden)
        .catch(() => setShowHidden(false));
    });
  }, []);

  // Přípony „podle Windows“: nastavení Průzkumníku se čte při startu a při
  // návratu do okna (registr žádnou událost nepošle).
  useEffect(() => {
    const refresh = () => void refreshExplorerExtensions();
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const toggleHidden = useCallback(() => {
    setShowHidden((current) => {
      const next = !current;
      void storage.setShowHidden(next);
      return next;
    });
  }, []);

  // Nová verze na GitHubu: nejvýš jednou denně, až když okno stojí.
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    // Kontrola aktualizací nesmí nic rozbít ani hlásit — tiše bez proužku.
    void checkForUpdate()
      .then((found) => {
        if (alive) setUpdate(found);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ready, updates.check]);
  const updateBarShown = update !== null && updates.check;

  // Sklo: lišty leží přes výpis, views o tom vědí kvůli virtualizaci.
  const glassInsets = useMemo<GlassInsets>(
    () => ({ top: GLASS_TOP, bottom: GLASS_STATUS + GLASS_QUICK + (updateBarShown ? GLASS_UPDATE_BAR : 0) }),
    [updateBarShown],
  );

  // Linka pod skleněnou lištou jen tehdy, když pod ní je obsah: odscrollovaný
  // výpis, nebo sloupce (ty se posouvají každý zvlášť). Třídou přímo v DOM —
  // přes stav by každý scroll překreslil celou aplikaci. Proto musí className
  // na <main> zůstat statický řetězec, jinak by React třídu při renderu smazal.
  const mainRef = useRef<HTMLElement>(null);
  const syncBarLine = () => {
    const main = mainRef.current;
    if (!main) return;
    const scrolled = [...main.querySelectorAll<HTMLElement>(".fw-panel > .fw-scroll")].some(
      (element) => element.dataset.columns !== undefined || element.scrollTop > 0,
    );
    main.classList.toggle("is-scrolled", scrolled);
  };

  // Chyby zápisu nastavení (oblíbené, tagy) — jinak by skončily jen v konzoli.
  useEffect(
    () =>
      storage.onError((kind, detail) =>
        setNotice(failure(kind === "load" ? "op.loadSettings" : "op.saveSettings", detail)),
      ),
    [setNotice],
  );

  /*
   * Pravý klik — kde co otevírá (vše přes jednu komponentu ContextMenu):
   *
   * | Plocha                                  | Menu                                                     | Kde se otevírá            |
   * |-----------------------------------------|----------------------------------------------------------|---------------------------|
   * | položka v Icon / List / Column View     | Otevřít, Náhled, Otevřít v aplikaci, Průzkumník,         | App: openContextMenu      |
   * |                                         | Terminál, Oblíbené, Přejmenovat, Duplikovat, Kopírovat,  |                           |
   * |                                         | Vyjmout, Vložit, Kopírovat cestu/název, Smazat, Tagy,    |                           |
   * |                                         | Vlastnosti                                               |                           |
   * | položka ve výsledcích hledání / TagView | totéž (operace míří jen na ni, ne na výběr pod ní)       | App: openOverlayMenu      |
   * | volná plocha Icon / List View           | Nová složka, Nový soubor, Vložit, Průzkumník, Terminál,  | App: openBackgroundMenu   |
   * | volná plocha sloupce v Column View      | Kopírovat cestu, Zobrazit ▸, Seřadit podle ▸, Vybrat vše,|   (sloupec = jeho složka) |
   * |                                         | Aktualizovat, Oblíbené, Vlastnosti složky                |                           |
   * | stavový řádek                           | Kopírovat cestu aktuální složky, Upravit cestu           | App: openStatusMenu       |
   * | Quick Look                              | Otevřít, Otevřít v Průzkumníku, Kopírovat cestu          | App: openQuickLookMenu    |
   * | položky sidebaru                        | podle sekce (oblíbené, nedávné, systémové, tagy)         | Sidebar                   |
   * | nadpis sekce sidebaru                   | Sbalit/Rozbalit; u Nedávných i Vymazat nedávné           | Sidebar                   |
   * | volná plocha sidebaru                   | Přidat aktuální složku do oblíbených, Vymazat nedávné    | Sidebar                   |
   * | Toolbar, TitleBar, info panel, dialogy  | žádné — jen se blokuje nativní menu                      | tenhle handler            |
   * | INPUT / TEXTAREA                        | nativní menu webview (Kopírovat / Vložit)                | —                         |
   *
   * Handler běží v capture fázi. V bubble fázi by do window nedorazil nic, co
   * cestou zastavil stopPropagation (řádky si ho volají, aby se neotevřelo
   * i menu volné plochy) — a nativní menu by prošlo všude, kde komponenta
   * zapomene na vlastní preventDefault.
   */
  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
    }

    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    return () => window.removeEventListener("contextmenu", onContextMenu, { capture: true });
  }, []);

  useEffect(() => {
    const onFocus = () => setWindowFocused(true);
    const onBlur = () => setWindowFocused(false);

    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Kde uživatel právě je — pro odpovědi, které dorazí se zpožděním.
  const navCurrentRef = useRef(nav.current);
  navCurrentRef.current = nav.current;

  useEffect(() => {
    const favorites = systemPlaces.get().favorites();
    favorites.then(setSections).catch((err: unknown) => setError(failure("op.sidebar", err)));

    // Záložky z minulého spuštění — jen ty, jejichž složka pořád jde otevřít.
    // Pomalý síťový disk se nečeká: co neodpoví do chvilky, zůstane taky.
    const savedTabs = storage.init().then(async () => {
      const { items, active } = storage.getSnapshot().tabs;
      const checked = await Promise.all(
        items.map((item) =>
          Promise.race([
            fileSystem.get().canList(item.path).then(
              () => true,
              () => false,
            ),
            new Promise<boolean>((resolve) => window.setTimeout(() => resolve(true), 1500)),
          ]).then((ok) => (ok ? item : null)),
        ),
      );
      // Rozdělená záložka s nedostupnou složkou vpravo (odpojený disk) se vrátí
      // jen s levým panelem.
      const seconds = await Promise.all(
        checked.map((item) =>
          item?.second
            ? fileSystem.get().canList(item.second.path).then(
                () => true,
                () => false,
              )
            : Promise.resolve(true),
        ),
      );
      const cleaned = checked.map((item, index) =>
        item && item.second && !seconds[index] ? { ...item, second: undefined, activePanel: 0 as const } : item,
      );
      return { items: cleaned.filter((item) => item !== null), active: cleaned[active] ?? null };
    });

    void Promise.all([favorites.catch(() => [] as FavoriteSection[]), savedTabs.catch(() => null)]).then(
      ([result, saved]) => {
        tabsLoaded.current = true;
        // Výčet disků umí trvat sekundy (odpojený síťový disk). Kdo mezitím
        // sám někam došel (Ctrl+L, klik), toho to nesmí hodit zpátky.
        if (navCurrentRef.current !== null) return;

        if (saved && saved.items.length > 0) {
          const restored = saved.items.map((item): Tab => {
            const tab = newTab(item.path, {
              viewMode: item.view,
              sortKey: item.sortKey,
              sortDirection: item.sortDirection,
            });
            if (!item.second) return tab;
            const { path, view, sortKey: key, sortDirection: direction } = item.second;
            return {
              ...tab,
              second: blankSnapshot(path, { viewMode: view, sortKey: key, sortDirection: direction }),
              split: true,
              activePanel: item.activePanel ?? 0,
            };
          });
          const index = saved.active === null ? 0 : Math.max(0, saved.items.indexOf(saved.active));
          setTabs(restored);
          setActiveTabId(restored[index].id);
          applyTabRef.current(restored[index]);
          return;
        }

        const first = result[0]?.items[0];
        if (first) dispatch({ type: "go", path: first.path });
      },
    );
  }, []);

  // Připojený nebo odpojený disk (USB, síťový) se v sidebaru ukáže hned.
  // Tady se už nenaviguje — uživatel zůstává, kde je.
  useEffect(() => {
    const unlisten = systemPlaces.get().onDrivesChanged(() => {
      systemPlaces
        .get()
        .favorites()
        .then(setSections)
        .catch(() => undefined);
    });
    return () => void unlisten.then((stop) => stop());
  }, []);

  // Soubor v náhledu zmizel (smazán zvenčí, sloupec zrušil výběr) — Quick Look
  // se odmontuje sám, ale příznak by zůstal a jako "otevřený modal" by
  // blokoval všechny zkratky i tlačítka myši až do restartu.
  const quickLookShown = quickLookOpen && activeEntry !== null && !activeEntry.is_dir;
  const infoEntry = activeEntry ?? (currentDir !== null ? folderEntry(currentDir) : null);
  useEffect(() => {
    if (quickLookOpen && !quickLookShown) setQuickLookOpen(false);
  }, [quickLookOpen, quickLookShown]);

  /* ---------------------------- operace ---------------------------------- */

  /* ---------------------- živé obnovení otevřených složek ------------------- */

  // Backend hlídá jen to, co je vidět: v column view všechny sloupce, jinak
  // aktuální složku. Klíč místo pole, ať se hlídač nepřestavuje při každém renderu.
  const watchedKey = [...new Set(visiblePanels.flatMap((index) => panels[index].watchedPaths))].join("\n");

  // Pořadové číslo: volání běží souběžně a backend podle něj zahodí to starší,
  // kdyby doběhlo až po novějším.
  const watchGeneration = useRef(0);
  useEffect(() => {
    const paths = watchedKey === "" ? [] : watchedKey.split("\n");
    watchGeneration.current += 1;
    dirWatcher
      .get()
      .watch(paths, watchGeneration.current)
      .catch((err: unknown) => setNotice(failure("op.watch", err), errorDetail(err)));
  }, [watchedKey]);

  // Změnu na disku (nový soubor z prohlížeče, smazání v Průzkumníku…) ukáže
  // výpis sám. Ve výsledcích hledání ne — přehledávat kvůli každé změně
  // v podkladové složce celý strom by bylo drahé a výsledky by poskakovaly.
  useEffect(() => {
    const refreshVisible = () => {
      for (const index of visibleRef.current) {
        const target = panelsRef.current[index];
        if (target.search === null) target.refresh();
      }
    };
    const unlisten = dirWatcher.get().onChange(refreshVisible);
    // Přesun tažením ven (Průzkumník, Shift) — položky zmizí hned, nečeká se
    // na watcher. Cílovou složku neznáme, takže do Zpět se to nezapíše.
    const unlistenDrag = nativeDrag.get().onEnd((effect) => {
      if (effect === "move") refreshVisible();
    });
    return () => {
      void unlisten.then((stop) => stop());
      void unlistenDrag.then((stop) => stop());
    };
  }, []);

  /** Jediná cesta k otevření souboru — proto se nedávné zapisují právě tady. */
  const openFile = useCallback((entry: FileEntry) => {
    shellLauncher
      .get()
      .open(entry.path)
      // Zapisuje se až po úspěchu — jinak by se do nedávných dostaly i soubory,
      // které se otevřít nepodařilo.
      .then(() => storage.addRecent(entry.path, entry.name, "file"))
      .catch((err: unknown) => setNotice(failure("op.openFile", err), errorDetail(err)));
  }, []);

  const open = useCallback(
    (entry: FileEntry) => {
      if (entry.is_dir) {
        void storage.addRecent(entry.path, entry.name, "folder");

        // V column view se složka otevírá do dalšího sloupce (jako Enter a →).
        // navigate() by sloupce zbořil na jediný.
        if (isColumnView) {
          const parent = parentPath(entry.path);
          const index = columnsApi.columns.findIndex(
            (column) => parent !== null && storage.samePath(column.path, parent),
          );
          if (index >= 0) {
            columnsApi.openInto(index, entry);
            return;
          }
        }

        selectEntry(entry);
        navigate(entry.path);
      } else {
        selectEntry(entry);
        openFile(entry);
      }
    },
    [navigate, openFile, selectEntry, isColumnView, columnsApi],
  );

  /** Dvojklik ve výsledcích hledání / tag view: složka se otevře (a výsledky
   *  se tím zavřou), soubor spustí výchozí aplikací. Výběr v podkladové
   *  složce se nemění — položka v ní vůbec nemusí být. */
  const openFromResults = useCallback(
    (entry: FileEntry) => {
      if (!entry.is_dir) return openFile(entry);
      void storage.addRecent(entry.path, entry.name, "folder");
      navigate(entry.path);
    },
    [navigate, openFile],
  );

  /** Sidebar volá s holou cestou — nedávné o FileEntry nevědí. */
  const openRecentFile = useCallback(
    (path: string, name: string) => {
      openFile({
        name,
        path,
        is_dir: false,
        size: 0,
        modified: 0,
        created: 0,
        extension: null,
        hidden: false,
        is_symlink: false,
      });
    },
    [openFile],
  );

  /**
   * Kopie nenásleduje symlinky a junctions. Když nějaké přeskočila, musí se to
   * uživatel dozvědět — jinak by si myslel, že má úplnou kopii.
   */
  const noteSkippedLinks = useCallback((count: number) => {
    if (count > 0) showInfo(t("toast.skippedLinks", { count }));
  }, [showInfo]);

  /** Společné ošetření chyb + refresh po každé mutující operaci. */
  const runOperation = useCallback(
    async (label: MessageKey, action: () => Promise<unknown>) => {
      setNotice(null);
      try {
        await action();
      } catch (err: unknown) {
        // Odmítnutá výzva UAC chybou není.
        if (isCancelled(err)) showInfo(t("toast.cancelled"));
        else setNotice(failure(label, err), errorDetail(err));
      } finally {
        // Refresh patří i k neúspěchu. Operace mohla část práce stihnout a
        // zastaralý výpis, který ukazuje smazané soubory, je horší než chyba.
        refresh();
      }
    },
    [refresh, setNotice, showInfo],
  );

  /**
   * Hromadná operace nad výběrem. Nezastaví se na první chybě — jeden zamčený
   * soubor by jinak nechal zbytek výběru nedotčený a uživatel by se dozvěděl
   * jen o něm. Vrací, kolik položek prošlo.
   */
  const runBatch = useCallback(
    async <T,>(label: MessageKey, items: T[], action: (item: T) => Promise<unknown>) => {
      if (items.length === 0) return { ok: 0, failed: 0 };
      setNotice(null);

      let first: string | null = null;
      let firstDetail: string | undefined;
      let failed = 0;

      for (const item of items) {
        try {
          await action(item);
        } catch (err: unknown) {
          failed += 1;
          if (first === null) {
            first = errorText(err);
            firstDetail = errorDetail(err);
          }
        }
      }

      if (failed === 1) setNotice(failure(label, first), firstDetail);
      else if (failed > 1) {
        setNotice(
          t("error.batch", { action: t(label), failed, count: items.length, detail: first ?? "" }),
          firstDetail,
        );
      }

      refresh();
      return { ok: items.length - failed, failed };
    },
    [refresh],
  );

  /** „Pokračovat jako správce": dialog nad položkami, kterým chybí oprávnění. */
  const askAdmin = useCallback((paths: string[], retry: () => void) => {
    setConfirm({
      title: t("admin.title"),
      message:
        paths.length === 1
          ? t("admin.messageOne", { name: names.name(storage.lastSegment(paths[0])) })
          : t("admin.messageMany", { count: paths.length }),
      confirmLabel: t("admin.continue"),
      onConfirm: retry,
    });
  }, [names]);

  /** Hláška o položkách, které operace nezvládla: první v textu, všechny v podrobnostech. */
  const reportFailures = useCallback(
    (label: MessageKey, failed: ItemFailure[], count: number) => {
      if (failed.length === 0) return;
      // Zrušená výzva UAC chybou není.
      if (failed.every((item) => isCancelled(item.error))) {
        showInfo(t("toast.cancelled"));
        return;
      }
      const first = failureText(failed[0]);
      const lines = failed.flatMap((item) => {
        const detail = failureDetail(item);
        return detail ? [failureText(item), `  ${detail}`] : [failureText(item)];
      });
      // Jedna položka bez technického detailu: v rozbalení by nebylo nic nového.
      const detail = failed.length > 1 || lines.length > 1 ? lines.join("\n") : undefined;
      setNotice(
        failed.length === 1
          ? failure(label, first)
          : t("error.batch", { action: t(label), failed: failed.length, count, detail: first }),
        detail,
      );
    },
    [setNotice, showInfo],
  );

  /* ------------------------------ zpět / znovu ----------------------------- */

  const [history, setHistory] = useState<{ undo: UndoOp[]; redo: UndoOp[] }>({ undo: [], redo: [] });
  const historyRef = useRef(history);
  historyRef.current = history;
  /** Zpět / Znovu běží po jednom — dvojí Ctrl+Z by jinak vracelo totéž dvakrát. */
  const historyBusy = useRef(false);

  /** Nová operace: na vrchol zásobníku, Znovu tím propadá. */
  const record = useCallback((op: UndoOp) => {
    setHistory((current) => ({ undo: [...current.undo, op].slice(-UNDO_LIMIT), redo: [] }));
  }, []);

  // MI-FORK: ZIP, renombrar varios, comparar, agrupar por y tamaño de carpetas.
  const extras = useExtras({ targets: targetEntries, siblings: sortedEntries, runOperation, record, requestSelect, showInfo });

  const stepHistory = useCallback(
    async (direction: "undo" | "redo") => {
      const stack = historyRef.current[direction];
      const op = stack[stack.length - 1];
      if (op === undefined || historyBusy.current) return;

      historyBusy.current = true;
      // Ze zásobníku pryč hned — když inverze selže, operace se zahodí.
      setHistory((current) => ({ ...current, [direction]: current[direction].slice(0, -1) }));
      setNotice(null);
      try {
        if (direction === "undo") {
          await undoOp(op);
          setHistory((current) => ({ ...current, redo: [...current.redo, op] }));
        } else {
          const again = await redoOp(op);
          setHistory((current) => ({ ...current, undo: [...current.undo, again].slice(-UNDO_LIMIT) }));
        }
      } catch (err: unknown) {
        setNotice(failure(direction === "undo" ? "op.undo" : "op.redo", err), errorDetail(err));
      } finally {
        historyBusy.current = false;
        refresh();
      }
    },
    [refresh, setNotice],
  );

  /** Změna tagů s možností Zpět: stav před a po pro dotčené cesty. */
  const changeTags = useCallback(
    (paths: string[], action: () => Promise<void>) => {
      const snapshot = () => {
        const tags = storage.getSnapshot().tags;
        return Object.fromEntries(paths.map((path) => [path, storage.tagsOf(tags, path)]));
      };
      const before = snapshot();
      void action()
        .then(() => {
          const after = snapshot();
          // Klik, který nic nezměnil, nemá být krok Zpět.
          if (JSON.stringify(before) !== JSON.stringify(after)) record({ kind: "tags", before, after });
        })
        .catch((err: unknown) => setNotice(failure("op.saveSettings", err), errorDetail(err)));
    },
    [record, setNotice],
  );

  const submitRename = useCallback(
    (entry: FileEntry, name: string) => {
      setRenamingPath(null);
      const next = name.trim();
      if (next === entry.name) return;

      const dir = parentPath(entry.path);

      void runOperation("op.rename", async () => {
        let renamed: string;
        try {
          renamed = await renamePath(entry.path, next);
        } catch (err: unknown) {
          if (!needsAdmin(err)) throw err;
          // Jako správce: bez Zpět — vrácení by oprávnění potřebovalo znovu.
          askAdmin([entry.path], () =>
            void runOperation("op.rename", async () => {
              const elevated = await renameElevated(entry.path, next);
              await storage.remapPath(entry.path, elevated);
              if (dir !== null) requestSelect(dir, elevated);
            }),
          );
          return;
        }
        // Tagy, oblíbené a nedávné jsou klíčované cestou — musí jít s položkou.
        await storage.remapPath(entry.path, renamed);
        record({ kind: "rename", from: entry.path, to: renamed });
        // Přejmenovaná položka má novou cestu, takže by po refreshi vypadla
        // z výběru. Takhle zůstane označená, jak to dělá Finder i Průzkumník.
        if (dir !== null) requestSelect(dir, renamed);
      });
    },
    [runOperation, requestSelect, record, askAdmin],
  );

  /** `permanent` = mimo Koš (Shift+Delete). */
  const deleteEntries = useCallback(
    (items: FileEntry[], permanent = false) => {
      const paths = items.map((entry) => entry.path);
      if (paths.length === 0) return;

      // Zpět jde jen u Koše — trvale smazané se vrátit nedá. Ani to, co se
      // mazalo jako správce: obnovení z Koše by oprávnění potřebovalo znovu.
      const run = (targets: string[], toTrash: boolean, elevate: boolean) =>
        void runOperation("op.delete", async () => {
          const since = trashTimestamp();
          const report = await deletePaths(targets, !toTrash, elevate);
          if (toTrash && !elevate && report.deleted.length > 0) {
            record({ kind: "trash", paths: report.deleted, since });
          }
          const admin = report.failed.filter((item) => item.admin);
          const other = report.failed.filter((item) => !item.admin);
          reportFailures("op.delete", other, targets.length);
          if (admin.length > 0) {
            const items = [...new Set(admin.map((item) => item.item))];
            askAdmin(items, () => run(items, toTrash, true));
          }
        });

      const confirmPermanent = (message: string) =>
        setConfirm({
          title:
            paths.length === 1
              ? t("confirm.deleteOne", { name: names.entry(items[0]) })
              : t("confirm.deleteMany", { count: paths.length }),
          message,
          confirmLabel: t("confirm.deleteConfirm"),
          danger: true,
          onConfirm: () => run(paths, false, false),
        });

      if (permanent) {
        confirmPermanent(t("confirm.deletePermanentMessage"));
        return;
      }

      // Flashka (FAT32 / exFAT) ani síťová cesta Koš nemají — "do koše" by tam
      // smazalo trvale a bez varování. Když se to nedá zjistit, radši se ptát.
      trashIsPermanent(paths)
        .catch(() => true)
        .then((noTrash) => {
          if (!noTrash) return run(paths, true, false);
          confirmPermanent(t("confirm.deleteMessage"));
        });
    },
    [runOperation, record, reportFailures, askAdmin],
  );

  const deleteTargets = useCallback(() => deleteEntries(targetEntries), [deleteEntries, targetEntries]);
  const deleteTargetsPermanently = useCallback(() => deleteEntries(targetEntries, true), [deleteEntries, targetEntries]);

  /* ---------------------------------- Koš ---------------------------------- */

  const { trashState, restoreRecycledItems, purgeRecycledItems, confirmEmptyTrash } = useRecycleBin({
    refreshTokens: [panels[0].refreshToken, panels[1].refreshToken],
    runOperation,
    reportFailures,
    askAdmin,
    setConfirm,
    displayName: names.name,
  });

  /** `select` = kopii rovnou označit. Ve výsledcích hledání se nesmí — označení
   *  by čekalo na výpis složky, ve které uživatel vůbec není. */
  const duplicateEntry = useCallback(
    (entry: FileEntry, select = true) => {
      const dir = parentPath(entry.path);

      void runOperation("op.duplicate", async () => {
        let copy: OpResult;
        try {
          copy = await duplicatePath(entry.path);
        } catch (err: unknown) {
          if (!needsAdmin(err) || dir === null) throw err;
          askAdmin([entry.path], () =>
            void runOperation("op.duplicate", async () => {
              const [outcome] = await transferElevated([{ from: entry.path, onConflict: "rename" }], dir, "copy");
              if (outcome?.failure) reportFailures("op.duplicate", [outcome.failure], 1);
              else if (outcome?.result) {
                await storage.copyTags(entry.path, outcome.result.path);
                if (select) requestSelect(dir, outcome.result.path);
              }
            }),
          );
          return;
        }
        await storage.copyTags(entry.path, copy.path);
        record({ kind: "copy", items: [{ from: entry.path, to: copy.path }] });
        if (select && dir !== null) requestSelect(dir, copy.path);
        noteSkippedLinks(copy.skipped_links);
      });
    },
    [runOperation, requestSelect, noteSkippedLinks, record, askAdmin, reportFailures],
  );

  const duplicateActive = useCallback(() => {
    if (activeEntry) duplicateEntry(activeEntry);
  }, [activeEntry, duplicateEntry]);

  /**
   * Vytvoří složku a nechá uživatele hned psát název, jako Finder i Průzkumník.
   * Kolizi názvu řeší backend číslem, takže druhá složka vznikne taky.
   */
  const newFolder = useCallback((into?: string) => {
    const dir = into ?? currentDir;
    if (dir === null) return;

    void runOperation("op.newFolder", async () => {
      let created: string;
      try {
        created = await createFolder(dir, t("name.newFolder"));
      } catch (err: unknown) {
        if (!needsAdmin(err)) throw err;
        askAdmin([dir], () =>
          void runOperation("op.newFolder", async () => {
            const elevated = await createFolderElevated(dir, t("name.newFolder"));
            requestSelect(dir, elevated);
            setRenamingPath(elevated);
          }),
        );
        return;
      }
      record({ kind: "create", path: created, folder: true });
      requestSelect(dir, created);
      setRenamingPath(created);
    });
  }, [currentDir, runOperation, requestSelect, record, askAdmin]);

  /** Prázdný textový soubor, rovnou v přejmenování — stejně jako Nová složka. */
  const newFile = useCallback(
    (dir: string) => {
      void runOperation("op.newFile", async () => {
        const created = await createFile(dir, t("name.newFile"));
        record({ kind: "create", path: created, folder: false });
        requestSelect(dir, created, true);
      });
    },
    [runOperation, requestSelect, record],
  );

  /** Soubor typu z menu Nový (registr ShellNew), rovnou v přejmenování. */
  const newShellItem = useCallback(
    (dir: string, type: ShellNewType) => {
      void runOperation("op.newFile", async () => {
        const created = await createShellNew(dir, type.extension, type.itemName ?? t("name.newShellItem", { type: type.name }));
        record({ kind: "create", path: created, folder: false, shellNew: type.extension });
        requestSelect(dir, created, true);
      });
    },
    [runOperation, requestSelect, record],
  );

  /** Menu Nový — toolbar i podmenu na prázdné ploše: Složka, Textový dokument, typy z registru. */
  const newMenuEntries = useCallback(
    (dir: string): Extract<MenuItem, { type: "item" } | { type: "separator" }>[] => {
      const typeIcon = (extension: string) =>
        typeIcons[extension] ? <img src={typeIcons[extension]} alt="" draggable={false} /> : undefined;
      return [
        {
          type: "item",
          label: t("new.folder"),
          shortcut: "Ctrl+Shift+N",
          icon: <FolderIcon size={16} />,
          onSelect: () => newFolder(dir),
        },
        { type: "item", label: t("new.textDocument"), icon: typeIcon(".txt"), onSelect: () => newFile(dir) },
        ...(shellNewTypes.length > 0 ? [{ type: "separator" as const }] : []),
        ...shellNewTypes.map((type) => ({
          type: "item" as const,
          label: type.name,
          icon: typeIcon(type.extension),
          onSelect: () => newShellItem(dir, type),
        })),
      ];
    },
    [typeIcons, shellNewTypes, newFolder, newFile, newShellItem],
  );

  const { checkClipboard, copyText, paste, copyToClipboard, otherDir, transferToOther, putOnClipboard, dropInto } = useClipboardTransfer({ setNotice, setClipboard, targetEntries, setClipboardHasItems, askConflict, runBatch, record, noteSkippedLinks, askAdmin, runOperation, reportFailures, currentDir, clipboard, otherPanel, search, tagFilter, trashView });

  /** Soubory z Průzkumníku nad volnou plochou — padnou do aktuální složky
   *  (v column view do sloupce pod myší). Řádky složek si je chytí samy. */
  const [backgroundDrop, setBackgroundDrop] = useState<0 | 1 | null>(null);
  const backgroundDropDir = (q: Panel, event: React.DragEvent): string | null => {
    if (q.tagFilter !== null || q.search !== null || q.trashView) return null;
    const column = (event.target as Element).closest<HTMLElement>("[data-column-path]");
    const dir = column?.dataset.columnPath ?? q.currentDir;
    if (dir === null) return null;
    if (isExternalFileDrag(event)) return dir;
    // Položky z výpisu: jen když míří jinam, než kde už leží (typicky z druhého panelu).
    const payload = getDrag();
    if (payload?.kind !== "entry" || !canDropInto(dir, payload)) return null;
    const elsewhere = payload.items.some((item) => {
      const parent = parentPath(item.path);
      return parent === null || !storage.samePath(parent, dir);
    });
    return elsewhere ? dir : null;
  };

  /* -------------------------------- záložky -------------------------------- */

  const {
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
  } = useTabActions({
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
  });

  // MI-FORK: carpetas de Acceso rápido en la lista de saltos del icono de la barra de tareas.
  const jumpListFolders = favorites.filter((item) => item.type !== "file").map((item) => item.path);
  // MI-FORK: carpeta de la terminal / lista de saltos en pestaña nueva; la pestaña nueva usa el panel izquierdo.
  const openLaunch = useStableCallback(({ path, select }: Launch) => {
    openTab(path);
    if (select !== null) panels[0].requestSelect(path, select);
  });
  useJumpList(tagFilter === null && search === null && !trashView ? nav.current : null, jumpListFolders, openLaunch);

  /**
   * MI-FORK: ouško puštěné na polovinu plochy panelů — záložka se otevře
   * v panelu `side` aktivní záložky a okno se rozdělí. Nic se neztratí:
   * panel, který na té straně byl, i druhý panel tažené rozdělené záložky
   * zůstanou jako záložky na místě taženého ouška.
   */
  const [draggedTab, setDraggedTab] = useState<number | null>(null);
  const [splitDropSide, setSplitDropSide] = useState<0 | 1 | null>(null);
  /**
   * MI-FORK: složka ze sidebaru puštěná na plochu panelů — vlevo / vpravo se
   * otevře v tom panelu (okno se rozdělí, dosavadní obsah přejde na druhou
   * stranu), uprostřed v nové záložce.
   */
  const dragPayload = useDrag();
  const folderDrag = draggedFolder(dragPayload);
  const folderDragName =
    dragPayload?.kind === "place" ? dragPayload.name : folderDrag !== null ? tabTitle(folderDrag) : "";
  const [folderDropZone, setFolderDropZone] = useState<0 | 1 | "tab" | null>(null);
  useEffect(() => {
    if (folderDrag === null) setFolderDropZone(null);
  }, [folderDrag]);
  // Otevřené záložky do settings.json — při startu se obnoví. S jedinou
  // záložkou se nic neukládá: start zůstává jako dřív, v první oblíbené.
  useEffect(() => {
    if (!tabsLoaded.current) return;
    setTreeTabOrder(openTabs.map((tab) => tab.id)); // MI-FORK: árbol por pestaña
    const saved = (state: Pick<TabSnapshot, "nav" | "viewMode" | "sortKey" | "sortDirection">) =>
      state.nav.current === null
        ? null
        : { path: state.nav.current, view: state.viewMode, sortKey: state.sortKey, sortDirection: state.sortDirection };
    // Rozdělená záložka se ukládá i s jedinou záložkou — jinak by se rozdělení ztratilo.
    const worthSaving = openTabs.length >= 2 || splitOn;
    const items = !worthSaving ? [] : openTabs.flatMap((tab) => {
      const live = tab.id === activeTabId;
      const state = live ? { ...captureTab(), id: tab.id } : tab;
      const first = saved(state.snapshot);
      if (first === null) return [];
      const second = state.split && state.second ? saved(state.second) : null;
      return [second ? { ...first, second, activePanel: state.activePanel ?? 0 } : first];
    });
    const value = { items, active: Math.max(0, openTabs.findIndex((tab) => tab.id === activeTabId)) };
    if (JSON.stringify(storage.getSnapshot().tabs) !== JSON.stringify(value)) void storage.setSavedTabs(value);
  }, [tabs, activeTabId, nav.current, viewMode, sortKey, sortDirection, splitOn, activePanel, panels[1].nav.current]);

  // Prostřední tlačítko na složce ve výpisu = otevřít v nové záložce.
  const folderAt = useStableCallback((path: string): boolean => {
    const lists = panels.flatMap((item) => [item.visibleEntries, ...item.columnsApi.columns.map((column) => column.entries)]);
    return lists.some((list) => list.some((entry) => entry.path === path && entry.is_dir));
  });
  useEffect(() => {
    function onMiddle(event: MouseEvent) {
      if (event.button !== 1) return;
      const row = (event.target as Element | null)?.closest<HTMLElement>("[data-path]");
      const path = row?.dataset.path;
      if (!path || !folderAt(path)) return;
      // Bez tohohle by webview spustilo automatické posouvání kolečkem.
      event.preventDefault();
      if (event.type === "auxclick") openTab(path);
    }
    window.addEventListener("mousedown", onMiddle, true);
    window.addEventListener("auxclick", onMiddle, true);
    return () => {
      window.removeEventListener("mousedown", onMiddle, true);
      window.removeEventListener("auxclick", onMiddle, true);
    };
  }, [folderAt, openTab]);

  /* --------------------------- klávesové zkratky -------------------------- */

  /** Cokoliv, co překrývá hlavní panel a obsluhuje si klávesy samo. */
  const modalOpen =
    quickLookOpen ||
    overlayPreview !== null ||
    menu !== null ||
    propertiesFor !== null ||
    aboutOpen ||
    paletteOpen ||
    confirm !== null ||
    conflict !== null ||
    toolbarMenuOpen;

  useKeyboardNavigation({ modalOpen, switchToTabNumber, tagFilter, search, trashView, commandsRef, setQuery, activeEntry, setQuickLookOpen, viewMode, moveSelection, isColumnView, viewMetrics, selectIndex, visibleEntries, findByPrefix, setSelection, setActive, open });

  /* -------------------------- boční tlačítka myši ------------------------- */

  // MB4/MB5 = zpět/vpřed v historii, přesně jako šipky v toolbaru.
  //
  // Posluchače běží v capture fázi. React má delegaci až na kontejneru a Quick
  // Look si v onMouseDown volá stopPropagation, takže v bubble fázi by událost
  // do window vůbec nedorazila.
  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (event.button !== 3 && event.button !== 4) return;
      // Quick Look si boční tlačítka obsluhuje sám — přepíná jimi soubory.
      if (quickLookOpen || overlayPreview !== null) return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      if (event.button === 3) goBack();
      else goForward();
    }

    // Bez tohohle by webview na boční tlačítka odnavigovalo vlastní historii
    // a odešlo pryč ze stránky aplikace. Ruší se proto vždy, i v Quick Look.
    function swallow(event: MouseEvent) {
      if (event.button === 3 || event.button === 4) event.preventDefault();
    }

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", swallow, true);
    window.addEventListener("auxclick", swallow, true);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mouseup", swallow, true);
      window.removeEventListener("auxclick", swallow, true);
    };
  }, [quickLookOpen, overlayPreview, goBack, goForward]);

  /* ----------------------------- view mode -------------------------------- */

  const cutPaths = useMemo(
    () => new Set(clipboard?.mode === "cut" ? clipboard.paths : []),
    [clipboard],
  );

  /* ---------------------------- context menu ------------------------------ */

  const openContextMenu = useCallback((entry: FileEntry, x: number, y: number) => {
    // Pravý klik na položku, která už ve výběru je, výběr nezahazuje — jinak by
    // ze "Smazat 5 položek" zbyla jedna. Aktivní se stane ta, na které je menu
    // otevřené, aby operace pro jednu položku mířily tam, kam uživatel klikl.
    setSelection((current) => (current.has(entry.path) ? current : new Set([entry.path])));
    setActive(entry);
    checkClipboard();
    setMenu({ kind: "entry", x, y, entry, overlay: false });
  }, [checkClipboard]);

  /** Položka z výsledků hledání nebo z tag view. Výběr podkladové složky se
   *  nechává být — ta položka v něm vůbec není. */
  const openOverlayMenu = useCallback((entry: FileEntry, x: number, y: number) => {
    checkClipboard();
    setMenu({ kind: "entry", x, y, entry, overlay: true });
  }, [checkClipboard]);

  /** Pravý klik do volné plochy panelu — menu složky, ve které uživatel stojí. */
  const openBackgroundMenu = useCallback(
    (event: React.MouseEvent) => {
      // Tag view ani výsledky hledání nejsou složka, takže "Nová složka" ani
      // "Vložit" by neměly kam mířit. Nativní menu tam blokuje globální handler.
      if (tagFilter !== null || search !== null || trashView || currentDir === null) return;
      // V rozepsaném přejmenování má pravý klik nechat projít menu webview —
      // jinak by přes input vyskočilo menu složky a uživatel se nedostal
      // k vložení názvu ze schránky.
      if (isTypingTarget(event.target)) return;

      // V column view patří prázdné místo pod řádky sloupci, do kterého uživatel
      // klikl — ne nejhlubšímu otevřenému. Mimo sloupce (info panel) zbývá ten.
      const column = (event.target as Element).closest<HTMLElement>("[data-column-path]");
      const dir = column?.dataset.columnPath ?? currentDir;

      event.preventDefault();
      checkClipboard();
      setMenu({ kind: "background", x: event.clientX, y: event.clientY, dir });
    },
    [tagFilter, trashView, search, currentDir, checkClipboard],
  );

  /** Klik do prázdné plochy Icon / List View zruší výběr. Column view to řeší
   *  po sloupcích sám, overlaye výběr v podkladové složce nemají. */
  const clearSelectionOnBackground = useCallback(
    (event: React.MouseEvent) => {
      if (isColumnView || tagFilter !== null || search !== null || trashView) return;
      if ((event.target as Element).closest("[data-path]")) return;
      setSelection(new Set());
      setActive(null);
    },
    [isColumnView, tagFilter, trashView, search],
  );

  /** Tag view a výsledky hledání se navzájem vylučují — jinak by status bar
   *  hlásil počet z hledání a živé obnovení zůstalo vypnuté. */
  const selectTag = useCallback(
    (color: TagColor) => {
      if (search !== null) setQuery("");
      setSearch(null);
      setOverlaySelected(null);
      setTrashView(false);
      setComputerView(false);
      setTagFilter(color);
    },
    [search],
  );

  /** Pohled na Koš — vylučuje se s tag view i výsledky hledání. */
  const openTrash = useCallback(() => {
    if (search !== null) setQuery("");
    setSearch(null);
    setOverlaySelected(null);
    setTagFilter(null);
    setComputerView(false);
    setTrashView(true);
  }, [search]);

  /** MI-FORK: pohled «Este equipo» — tarjetas de unidades; vylučuje se s Košem, tagy i hledáním. */
  const openComputer = useCallback(() => {
    if (search !== null) setQuery("");
    setSearch(null);
    setOverlaySelected(null);
    setTagFilter(null);
    setTrashView(false);
    setComputerView(true);
  }, [search]);

  const openStatusMenu = useCallback(
    (x: number, y: number) => {
      if (currentDir !== null) setMenu({ kind: "status", x, y, dir: currentDir });
    },
    [currentDir],
  );

  /** Soubor přepnutý šipkami v Quick Look se označí i ve výpisu. */
  const syncQuickLookSelection = useCallback(
    (entry: FileEntry) => {
      if (isColumnView) columnsApi.select(columnsApi.focusedIndex, entry);
      else selectEntry(entry);
    },
    [isColumnView, columnsApi, selectEntry],
  );

  const openQuickLookMenu = useCallback((entry: FileEntry, x: number, y: number) => {
    setMenu({ kind: "quicklook", x, y, entry });
  }, []);

  const previewEntry = useCallback(
    (entry: FileEntry) => {
      // Náhled patří k jedné položce — výběr se proto scvrkne na ni.
      selectEntry(entry);
      setQuickLookOpen(true);
    },
    [selectEntry],
  );

  const revealInExplorer = useCallback(
    (path: string) => {
      void runOperation("op.explorer", () => openInExplorer(path));
    },
    [runOperation],
  );

  const openTerminalAt = useCallback(
    (path: string, terminal?: TerminalId) => {
      void runOperation("op.terminal", () => openTerminal(path, terminal));
    },
    [runOperation],
  );

  /** Podmenu Shift+klik na „Otevřít v terminálu": každý dostupný terminál. */
  const terminalItems = useCallback(
    (path: string): Extract<MenuItem, { type: "item" }>[] =>
      (terminals ?? []).map((id) => ({
        type: "item",
        label: t(TERMINAL_LABELS[id]),
        onSelect: () => openTerminalAt(path, id),
      })),
    [terminals, openTerminalAt],
  );

  const menuItems = useMemo((): MenuItem[] => buildContextMenuItems({ menu, copyText, openTabs, activeTabId, splitOn, separateTab, closeTab, closeOtherTabs, setPathEditing, openFile, runOperation, revealInExplorer, favorites, newMenuEntries, clipboardHasItems, paste, folderApps, openTerminalAt, terminalItems, viewMode, changeViewMode, showHidden, toggleHidden, extras, sortKey, setSortKey, sortDirection, setSortDirection, isColumnView, visibleEntries, selectAll, refresh, setPropertiesFor, targetEntries, tags, openFromResults, open, openTab, reveal, setOverlayPreview, previewEntry, names, setRenamingPath, duplicateEntry, copyToClipboard, otherDir, transferToOther, deleteEntries, changeTags, git }), [
    menu,
    tabs, // MI-FORK: menu záložky
    activeTabId,
    splitOn,
    tags,
    favorites,
    targetEntries,
    clipboardHasItems,
    isColumnView,
    visibleEntries.length,
    viewMode,
    sortKey,
    sortDirection,
    showHidden,
    toggleHidden,
    open,
    openFile,
    openFromResults,
    reveal,
    previewEntry,
    revealInExplorer,
    openTerminalAt,
    runOperation,
    duplicateEntry,
    copyToClipboard,
    copyText,
    paste,
    deleteEntries,
    newFolder,
    newFile,
    newMenuEntries,
    terminalItems,
    refresh,
    selectAll,
    changeViewMode,
    changeTags,
    openTab,
    otherDir,
    transferToOther,
    git.menuItems, // MI-FORK
    extras.menuItems, // MI-FORK
    extras.groupByMenu, // MI-FORK
    extras.folderSizesItem, // MI-FORK
    locale,
    folderApps, // MI-FORK
  ]);

  /* ------------------------- menu tlačítek toolbaru ------------------------ */

  const toolbarSortItems = useMemo((): MenuItem[] => buildToolbarSortItems({ sortKey, setSortKey, sortDirection, setSortDirection, viewMode, extras }), [sortKey, sortDirection, locale, viewMode, extras.groupByMenu]);

  /** Zpět / Znovu na začátku menu Více — s názvem operace, jako ve Finderu. */
  /* -------------------------------- příkazy -------------------------------- */

  const lastUndo = history.undo[history.undo.length - 1];
  const lastRedo = history.redo[history.redo.length - 1];
  const overlayMode = tagFilter !== null || search !== null || trashView;
  // Typy z menu Nový v paletě („Nový: Dokument aplikace Word").
  const paletteNewActions: PaletteAction[] =
    currentDir === null || overlayMode
      ? []
      : shellNewTypes.map((type) => ({
          key: `new:${type.extension}`,
          title: t("palette.newItem", { type: type.name }),
          icon: typeIcons[type.extension] ? (
            <img src={typeIcons[type.extension]} alt="" width={16} height={16} draggable={false} />
          ) : (
            <Plus size={15} strokeWidth={1.75} className="text-secondary" />
          ),
          run: () => newShellItem(currentDir, type),
        }));
  const commands = buildCommands(
    {
      palette: { run: () => setPaletteOpen(true) },
      newTab: { run: () => openTab(currentDir), enabled: currentDir !== null },
      closeTab: { run: () => closeTab(activeTabId), enabled: openTabs.length > 1 },
      nextTab: { run: () => cycleTab(1), enabled: openTabs.length > 1 },
      previousTab: { run: () => cycleTab(-1), enabled: openTabs.length > 1 },
      toggleSplit: { run: toggleSplit, checked: splitOn },
      separateTabs: { run: () => separateTab(activeTabId), enabled: splitOn },
      switchPanel: { run: () => setActivePanel(activePanel === 0 ? 1 : 0), enabled: splitVisible },
      copyToOther: { run: () => transferToOther("copy"), enabled: splitVisible && otherDir !== null },
      moveToOther: { run: () => transferToOther("cut"), enabled: splitVisible && otherDir !== null },
      newFolder: { run: () => newFolder(), enabled: currentDir !== null && !overlayMode },
      newFile: {
        run: () => {
          if (currentDir !== null) newFile(currentDir);
        },
        enabled: currentDir !== null && !overlayMode,
      },
      newItem: { run: () => setNewMenuRequest((count) => count + 1), enabled: currentDir !== null && !overlayMode },
      viewIcons: { run: () => changeViewMode("icon"), checked: viewMode === "icon" },
      viewList: { run: () => changeViewMode("list"), checked: viewMode === "list" },
      viewColumns: { run: () => changeViewMode("column"), checked: viewMode === "column" },
      toggleHidden: { run: toggleHidden, checked: showHidden === true },
      toggleTheme: { run: toggleTheme, title: theme === "dark" ? t("toolbar.lightMode") : t("toolbar.darkMode") },
      themeLight: { run: () => changeTheme("light"), checked: themePreference === "light" },
      themeDark: { run: () => changeTheme("dark"), checked: themePreference === "dark" },
      themeSystem: { run: () => changeTheme("system"), checked: themePreference === "system" },
      languageSystem: { run: () => void languageSetting.set("system"), checked: language === "system" },
      languageEnglish: { run: () => void languageSetting.set("en"), checked: language === "en" },
      languageCzech: { run: () => void languageSetting.set("cs"), checked: language === "cs" },
      languageSpanish: { run: () => void languageSetting.set("es"), checked: language === "es" },
      extensionsWindows: {
        run: () => void storage.setExtensionMode("windows"),
        checked: extensionMode === "windows",
      },
      extensionsAlways: { run: () => void storage.setExtensionMode("always"), checked: extensionMode === "always" },
      extensionsNever: { run: () => void storage.setExtensionMode("never"), checked: extensionMode === "never" },
      motionSystem: { run: () => void storage.setMotion("system"), checked: motion === "system" },
      motionOn: { run: () => void storage.setMotion("on"), checked: motion === "on" },
      motionOff: { run: () => void storage.setMotion("off"), checked: motion === "off" },
      // Průhlednost jen tam, kde Windows Acrylic umí (enabled — menu i paleta ji jinak skryjí).
      transparencyOff: {
        run: () => void storage.setWindowTransparency(false),
        checked: !windowTransparency,
        enabled: acrylicAvailable,
      },
      transparencyBlur: {
        run: () => void storage.setWindowTransparency(true),
        checked: windowTransparency,
        enabled: acrylicAvailable,
      },
      toggleTransparency: {
        run: () => void storage.setWindowTransparency(!windowTransparency),
        title: windowTransparency ? t("command.transparencyOff") : t("command.transparencyOn"),
        enabled: acrylicAvailable,
      },
      transparencySubtle: {
        ...strengthCommand("subtle", windowTransparency && transparencyStrength === "subtle"),
        enabled: acrylicAvailable,
      },
      transparencyMedium: {
        ...strengthCommand("medium", windowTransparency && transparencyStrength === "medium"),
        enabled: acrylicAvailable,
      },
      transparencyStrong: {
        ...strengthCommand("strong", windowTransparency && transparencyStrength === "strong"),
        enabled: acrylicAvailable,
      },
      terminalAuto: { run: () => void storage.setTerminal("auto"), checked: terminal === "auto" },
      terminalWindows: {
        run: () => void storage.setTerminal("windowsTerminal"),
        checked: terminal === "windowsTerminal",
        enabled: hasTerminal("windowsTerminal"),
      },
      terminalPwsh: { run: () => void storage.setTerminal("pwsh"), checked: terminal === "pwsh", enabled: hasTerminal("pwsh") },
      terminalPowerShell: {
        run: () => void storage.setTerminal("powershell"),
        checked: terminal === "powershell",
        enabled: hasTerminal("powershell"),
      },
      terminalCmd: { run: () => void storage.setTerminal("cmd"), checked: terminal === "cmd", enabled: hasTerminal("cmd") },
      goBack: { run: goBack, enabled: nav.back.length > 0 },
      goForward: { run: goForward, enabled: nav.forward.length > 0 },
      goParent: { run: goToParent, enabled: currentDir !== null && parentPath(currentDir) !== null },
      openSelection: {
        run: () => {
          if (activeEntry) open(activeEntry);
        },
        enabled: activeEntry !== null,
      },
      editPath: { run: () => setPathEditing(true) },
      find: {
        run: () => {
          searchRef.current?.focus();
          searchRef.current?.select();
        },
      },
      advancedSearch: { run: openAdvancedSearch, enabled: currentDir !== null },
      refresh: { run: refresh },
      undo: {
        run: () => void stepHistory("undo"),
        enabled: lastUndo !== undefined,
        title: lastUndo ? t("undo.undoAction", { action: undoLabel(lastUndo, names.name) }) : undefined,
      },
      redo: {
        run: () => void stepHistory("redo"),
        enabled: lastRedo !== undefined,
        title: lastRedo ? t("undo.redoAction", { action: undoLabel(lastRedo, names.name) }) : undefined,
      },
      copy: {
        // Ve výsledcích hledání / tag view jen položka vybraná tam.
        run: () => {
          if (!overlayMode) copyToClipboard("copy");
          else if (overlaySelected) putOnClipboard([overlaySelected.path], "copy");
        },
      },
      cut: { run: () => copyToClipboard("cut") },
      paste: { run: () => paste() },
      duplicate: { run: duplicateActive },
      selectAll: { run: selectAll, enabled: !isColumnView },
      rename: {
        run: () => {
          if (activeEntry) setRenamingPath(activeEntry.path);
        },
        enabled: activeEntry !== null,
      },
      delete: { run: deleteTargets, enabled: targetEntries.length > 0 },
      deletePermanently: { run: deleteTargetsPermanently, enabled: targetEntries.length > 0 },
      openTrash: { run: openTrash },
      openComputer: { run: openComputer }, // MI-FORK
      emptyTrash: { run: confirmEmptyTrash, enabled: trashState === null || trashState.count > 0 },
      copyPath: {
        run: () => {
          const path = activeEntry?.path ?? currentDir;
          if (path !== null) copyText(path, "op.copyPath");
        },
        enabled: activeEntry !== null || currentDir !== null,
      },
      openTerminal: {
        run: () => {
          if (currentDir !== null) openTerminalAt(currentDir);
        },
        enabled: currentDir !== null,
      },
      checkUpdates: { run: () => void storage.setUpdates({ check: !updates.check }), checked: updates.check },
      about: { run: () => setAboutOpen(true) },
      ...git.handlers, // MI-FORK: Git integrado.
      ...extras.handlers, // MI-FORK: extras (ZIP, renombrar varios, comparar).
    },
    t,
  );
  commandsRef.current = commands;

  /* ---------------------------- paleta příkazů ----------------------------- */

  /** Složky pro paletu: oblíbené, nedávné, otevřené záložky, podsložky aktuální. */
  const paletteFolders = useMemo((): PaletteFolder[] => {
    if (!paletteOpen) return [];
    const list: PaletteFolder[] = [];
    for (const section of sections) {
      for (const item of section.items) if (!item.external) list.push({ path: item.path, source: "favorite" });
    }
    for (const item of favorites) if (item.type === "folder") list.push({ path: item.path, source: "favorite" });
    for (const item of recents) if (item.type === "folder") list.push({ path: item.path, source: "recent" });
    for (const tab of tabs) {
      const path = tab.id === activeTabId ? nav.current : tabFace(tab).nav.current;
      if (path !== null) list.push({ path, source: "tab" });
    }
    const children = isColumnView ? (focusedColumn?.entries ?? []) : visibleEntries;
    for (const entry of children) if (entry.is_dir) list.push({ path: entry.path, source: "subfolder" });
    return list;
  }, [paletteOpen, sections, favorites, recents, tabs, activeTabId, nav.current, isColumnView, focusedColumn, visibleEntries]);

  /** Text z palety, který vypadá jako cesta: ~ = domovská složka, soubor se odkryje. */
  const goToTypedPath = useCallback(
    async (text: string) => {
      let path = text.trim().replace(/\//g, "\\");
      if (/^~([\\]|$)/.test(path)) path = (await systemPlaces.get().homeDir()).replace(/\\$/, "") + path.slice(1);
      if (/^[a-z]:$/i.test(path)) path += "\\";
      try {
        await fileSystem.get().canList(path);
        navigate(path);
      } catch (err: unknown) {
        // Soubor: otevře se složka, ve které leží, a označí se v ní.
        const [stat] = await statPaths([path]).catch(() => [] as StatResult[]);
        if (stat?.entry && !stat.entry.is_dir) reveal(stat.entry.path);
        else setNotice(failure("op.openFolder", err), errorDetail(err));
      }
    },
    [navigate, reveal, setNotice],
  );

  // Sdílet míří na výběr; bez výběru na složku, ve které uživatel stojí.
  const sharePaths = useMemo(
    () =>
      targetEntries.length > 0
        ? targetEntries.map((entry) => entry.path)
        : currentDir !== null
          ? [currentDir]
          : [],
    [targetEntries, currentDir],
  );

  const toolbarShareItems = useMemo((): MenuItem[] => buildToolbarShareItems({ sharePaths, copyText, putOnClipboard, revealInExplorer }), [sharePaths, copyText, putOnClipboard, revealInExplorer, locale]);

  // Štítky výběru: barva je zaškrtnutá, když ji mají všechny vybrané položky.
  // Klik ji pak všem odebere, jinak ji přidá všem — jako ve Finderu.
  const toolbarTagItems = useMemo((): MenuItem[] | null => buildToolbarTagItems({ targetEntries, tags, changeTags }), [targetEntries, tags, changeTags, locale]);

  // Ikona před názvem v toolbaru: stejná jako u složky v sidebaru, jinak
  // obecná složka; v tag view puntík barvy, ve výsledcích lupa.
  const folderIcon = (() => {
    if (computerView) return <Monitor size={16} strokeWidth={1.75} className="text-secondary" />; // MI-FORK
    if (trashView) return <Trash2 size={16} strokeWidth={1.75} className="text-secondary" />;
    if (tagFilter !== null) {
      return (
        <span
          className="block rounded-full"
          style={{ width: 12, height: 12, background: TAG_HEX[tagFilter] }}
        />
      );
    }
    if (search !== null) return <Search size={16} strokeWidth={1.75} className="text-secondary" />;

    for (const section of sections) {
      const item = section.items.find(
        (candidate) => nav.current !== null && storage.samePath(candidate.path, nav.current),
      );
      if (item) {
        const Icon = sidebarIcon(item.icon_name);
        return (
          <Icon size={16} strokeWidth={1.75} color={sidebarIconColor(section.id)} />
        );
      }
    }
    return <FolderIcon size={16} />;
  })();

  /** Místa pro lištu rozšířeného hledání: složka hledání, domov, disky. */
  function searchLocationsFor(root: string): SearchLocation[] {
    const rootCrumbs = breadcrumbs(root);
    const locations: SearchLocation[] = [
      { path: root, label: folderDisplayName(root, rootCrumbs[rootCrumbs.length - 1]?.label ?? root) },
    ];
    for (const section of sections) {
      for (const item of section.items) {
        if (item.external || (item.id !== "home" && item.letter === null)) continue;
        if (locations.some((location) => storage.samePath(location.path, item.path))) continue;
        locations.push({ path: item.path, label: sidebarLabel(item) });
      }
    }
    return locations;
  }

  const crumbs = nav.current ? breadcrumbs(nav.current) : [];
  const folderName = computerView
    ? t("menu.openComputer") // MI-FORK
    : trashView
    ? t("sidebar.trash")
    : tagFilter !== null
      ? tagLabel(tagFilter)
      : search !== null
        ? t("toolbar.searchResults")
        : crumbs.length > 0
          ? folderDisplayName(crumbs[crumbs.length - 1].path, crumbs[crumbs.length - 1].label)
          : "File Manager"; // MI-FORK

  // Status bar i Quick Look musí počítat s tím, co je opravdu vidět —
  // v column view tedy se zaměřeným sloupcem, ne s obsahem nav.current.
  const needle = filterQuery.trim().toLowerCase();

  const columnEntries = focusedColumn?.entries ?? [];
  const visibleColumnEntries = needle
    ? columnEntries.filter((entry) => entry.name.toLowerCase().includes(needle))
    : columnEntries;

  const previewEntries = isColumnView ? visibleColumnEntries : visibleEntries;

  // Pohled na Koš hlásí počet přes tagCount — je stejně jako tag view celek.
  const inTagView = tagFilter !== null || trashView;
  const inSearch = search !== null;

  // Ve výsledcích hledání není "z kolika" — počet nálezů je zároveň celek,
  // jinak by status bar hlásil zavádějící "N z M (filtr)".
  const statusVisibleCount = inSearch
    ? searchCount
    : inTagView
      ? tagCount
      : isColumnView
        ? visibleColumnEntries.length
        : visibleEntries.length;
  const statusTotalCount = inSearch
    ? searchCount
    : inTagView
      ? tagCount
      : isColumnView
        ? columnEntries.length
        : sortedEntries.length;

  // "Vybráno N z M" — ve výsledcích a v tag view výběr v podkladové složce není.
  const statusSelectedCount =
    inSearch || inTagView ? 0 : isColumnView ? (columnSelected ? 1 : 0) : targetEntries.length;

  // Přepnutí view, složky, hledání nebo záložky vymění scroller (či jeho
  // obsah) bez události scroll. Jen při těchhle změnách — App se překresluje
  // i při každém pohybu gumičky.
  const barLineKey = visiblePanels
    .map((index) => {
      const p = panels[index];
      return [p.nav.current, p.viewMode, p.search !== null, p.tagFilter, p.trashView, p.isColumnView].join("|");
    })
    .join(";");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(syncBarLine, [barLineKey, activeTabId]);

  /** Jeden panel: proužek načítání, výpis a vrstva pro snímek při přepnutí view. */
  function renderPanel(index: 0 | 1) {
    const q = panels[index];
    return (
      <div
        className={`fw-panel relative flex min-h-0 min-w-0 flex-col ${
          splitVisible && index === activePanel ? "is-active" : ""
        }`}
        style={splitVisible ? { flex: index === 0 ? `0 0 ${splitRatio * 100}%` : "1 1 0" } : { flex: "1 1 0" }}
        // Klik kamkoli do panelu ho nejdřív aktivuje — teprve pak dojde na
        // výběr, menu nebo tažení, a ty už míří na tenhle panel.
        onMouseDownCapture={() => activatePanel(index)}
        onDragStartCapture={() => activatePanel(index)}
      >
          {/* Navigace i přenačtení nechávají obsah na místě, takže by jinak
              nebylo nijak poznat, že se něco děje. */}
          {(q.loading || (q.isColumnView && q.columnsApi.rootLoading)) && q.search === null && q.tagFilter === null && !q.trashView && (
            <div className="fw-busy-line" aria-hidden />
          )}

          {/* key vynutí nový kontejner pro každé view (virtualizace si ho
              přeměří). Menu volné plochy visí až tady, ne ve views — prázdno
              pod řádky patří tomuhle scroll kontejneru, takže by ho mřížka
              IconView nezachytila. Řádky si událost zastaví u sebe. */}
          <div
            key={q.viewMode}
            ref={q.attachScroll}
            data-view={q.viewMode}
            onContextMenu={openBackgroundMenu}
            onClick={clearSelectionOnBackground}
            data-columns={
              q.isColumnView && q.search === null && q.tagFilter === null && !q.trashView && q.nav.current !== null
                ? ""
                : undefined
            }
            onScroll={(event) => {
              syncBarLine();
              // Pozice patří složce, jejíž výpis je právě vidět.
              const shown = q.loadedPathRef.current;
              if (shown !== null && !q.isColumnView) {
                q.scrollMemory.current.set(storage.pathKey(shown), event.currentTarget.scrollTop);
              }
            }}
            onMouseDown={(event) => {
              // Gumička jen nad výpisem složky — column view má vlastní po
              // sloupcích, výsledky hledání a tag view výběr nemají.
              if (!q.isColumnView && q.tagFilter === null && q.search === null && !q.trashView) q.band.onMouseDown(event);
            }}
            onDragOver={(event) => {
              if (backgroundDropDir(q, event) === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = event.ctrlKey ? "copy" : "move";
              setBackgroundDrop(index);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setBackgroundDrop(null);
            }}
            onDrop={(event) => {
              setBackgroundDrop(null);
              const dir = backgroundDropDir(q, event);
              if (dir === null) return;
              event.preventDefault();
              const copy = event.ctrlKey;
              const payload = getDrag();
              if (!isExternalFileDrag(event) && payload?.kind === "entry") {
                // Položky z druhého panelu do složky, kterou ukazuje tenhle.
                endDrag();
                dropInto(dir, payload.items.map((item) => item.path), copy);
                return;
              }
              void droppedPaths(event.dataTransfer).then((paths) => {
                if (paths.length > 0) dropInto(dir, paths, copy);
              });
            }}
            className={`fw-scroll min-h-0 flex-1 ${q.viewMode === "list" ? "overflow-x-auto" : "overflow-x-hidden"} overflow-y-auto ${
              backgroundDrop === index ? "fw-drop-zone" : ""
            }`}
          >
            <GlassInsetsContext.Provider value={glassInsets}>{renderContent(q)}</GlassInsetsContext.Provider>
            {q.band.overlay}
          </div>

          {/* Sem se při přepnutí view vloží snímek starého (spawnViewGhost).
              React do vrstvy nic nevykresluje, takže mu cizí uzel nevadí. */}
          <div ref={q.ghostHost} className="pointer-events-none absolute inset-0 z-10 empty:hidden" />
      </div>
    );
  }

  function renderContent(q: Panel) {
    const {
      tagFilter,
      trashView,
      computerView,
      overlaySelected,
      setOverlaySelected,
      refreshToken,
      setTagCount,
      search,
      setSearchCount,
      nav,
      error,
      isColumnView,
      columnsApi,
      renamingPath,
      setRenamingPath,
      pathEditing,
      awaitingFolder,
      skeletonShown,
      loadedPath,
      viewMode,
      loaded,
      scrollMemory,
    } = q;
    // Neaktivní panel ukazuje výběr šedě, jako okno bez fokusu.
    const windowFocused = windowFocusedAll && q === panel;

    if (computerView) {
      return (
        <ComputerView
          sections={sections}
          windowFocused={windowFocused}
          onOpen={(path) => navigate(path)}
          onOpenTab={openTab}
          onCountChange={setTagCount}
        />
      );
    }

    if (trashView) {
      return (
        <RecycleBinView
          windowFocused={windowFocused}
          refreshToken={refreshToken}
          onCountChange={setTagCount}
          onRestore={restoreRecycledItems}
          onPurge={purgeRecycledItems}
          onEmpty={confirmEmptyTrash}
        />
      );
    }

    if (tagFilter !== null) {
      return (
        <TagView
          color={tagFilter}
          windowFocused={windowFocused}
          selectedPath={overlaySelected?.path ?? null}
          onSelectionChange={setOverlaySelected}
          onOpen={openFromResults}
          onContextMenu={openOverlayMenu}
          refreshToken={refreshToken}
          onCountChange={setTagCount}
        />
      );
    }

    if (search !== null) {
      const view = (
        <SearchView
          root={search.root}
          query={search.query}
          criteria={search.criteria}
          windowFocused={windowFocused}
          selectedPath={overlaySelected?.path ?? null}
          onSelectionChange={setOverlaySelected}
          onOpen={openFromResults}
          onContextMenu={openOverlayMenu}
          refreshToken={refreshToken}
          showHidden={showHidden ?? false}
          onCountChange={setSearchCount}
        />
      );
      return (
        <div className="flex min-h-full flex-col">
          {/* Klíč: nové hledání z toolbaru (Enter) začíná od čisté lišty. */}
          <SearchCriteriaBar
            key={`${search.root}\0${search.query}\0${search.criteria === undefined}`}
            root={search.root}
            query={search.query}
            criteria={search.criteria ?? []}
            locations={searchLocationsFor(search.root)}
            onApply={q.applySearch}
          />
          <div className="flex min-h-0 flex-1 flex-col">{view}</div>
        </div>
      );
    }

    if (nav.current === null) {
      // Bez složky je jediné místo pro chybu (typicky z get_favorites) tady —
      // jinak by uživatel koukal na prázdný sidebar i panel bez vysvětlení.
      return <Placeholder>{error ?? t("empty.start")}</Placeholder>;
    }

    if (isColumnView) {
      return (
        <ColumnView
          api={columnsApi}
          windowFocused={windowFocused}
          onOpenFile={openFile}
          cutPaths={cutPaths}
          renamingPath={renamingPath}
          onRenameSubmit={submitRename}
          onRenameCancel={() => setRenamingPath(null)}
          onContextMenu={openContextMenu}
          tags={tags}
          suspended={modalOpen || renamingPath !== null || pathEditing || q !== panel}
          onDropInto={dropInto}
        />
      );
    }

    // Navigace obsah nevyprazdňuje: dokud nedorazí nová složka, zůstává
    // (neaktivní) ta předchozí pod proužkem načítání. Kostra až po 400 ms,
    // a hned jen tam, kde žádný předchozí obsah není (start aplikace).
    if (awaitingFolder && (skeletonShown || loadedPath === null)) {
      return skeletonShown ? <Skeleton view={viewMode === "list" ? "list" : "icon"} /> : null;
    }

    // Zpět / Vpřed se vrací tam, kde uživatel ve složce byl; jinak od začátku.
    const restoreTop =
      loaded.direction === "back" || loaded.direction === "forward"
        ? (scrollMemory.current.get(storage.pathKey(loadedPath ?? "")) ?? 0)
        : 0;

    return (
      <ViewTransition
        id={loadedPath}
        direction={loaded.direction}
        scrollTop={restoreTop}
        inert={awaitingFolder}
      >
        {renderFolder(q, restoreTop)}
      </ViewTransition>
    );
  }

  /** Obsah načtené složky v Icon / List View. */
  function renderFolder(q: Panel, initialOffset: number) {
    const {
      error,
      visibleEntries,
      query,
      selection,
      renamingPath,
      setRenamingPath,
      clickSelect,
      scrollRef,
      viewHandle,
      viewMode,
      sortKey,
      sortDirection,
      sortBy,
    } = q;
    const windowFocused = windowFocusedAll && q === panel;

    if (error) return <Placeholder>{failure("op.openFolder", error)}</Placeholder>;
    if (visibleEntries.length === 0) {
      return query ? (
        <EmptyState
          Icon={SearchX}
          title={t("empty.noMatches", { query: query.trim() })}
          hint={t("empty.noMatchesHint")}
        />
      ) : (
        <EmptyState
          Icon={FolderOpen}
          title={t("empty.folder")}
          hint={showHidden ? undefined : t("empty.folderHint")}
        />
      );
    }

    const shared = {
      entries: visibleEntries,
      selectedPaths: selection,
      cutPaths,
      windowFocused,
      renamingPath,
      onRenameSubmit: submitRename,
      onRenameCancel: () => setRenamingPath(null),
      onSelect: clickSelect,
      onDropInto: dropInto,
      onOpen: open,
      onContextMenu: openContextMenu,
      tags,
      scrollRef,
      handleRef: viewHandle,
      initialOffset,
    };

    if (viewMode === "list") {
      return (
        <ListView
          {...shared}
          pane={q === panels[1] ? 1 : 0} // MI-FORK: anchos de columna por panel
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={sortBy}
        />
      );
    }

    return <IconView {...shared} />;
  }

  return (
    // 100 %, ne 100vw/100vh: vw se při zlomkovém škálování zaokrouhlí a na
    // okraji by zůstal proužek podkladu.
    <div
      className={`fw-app flex h-full w-full flex-col overflow-hidden bg-window text-primary ${
        ready ? "is-ready" : ""
      }`}
    >
      <TitleBar windowFocused={windowFocused} />

      <div className="fw-body flex min-h-0 flex-1">
        <Sidebar
          sections={sections}
          currentPath={nav.current}
          windowFocused={windowFocused}
          onNavigate={navigate}
          onOpenTab={openTab}
          onOpenFile={openRecentFile}
          onReveal={reveal}
          activeTag={tagFilter}
          onSelectTag={selectTag}
          trashActive={trashView && !computerView}
          trashCount={trashState?.count ?? 0}
          onOpenTrash={openTrash}
          // MI-FORK: clic central en la Papelera — pestaña nueva con la vista de la Papelera.
          onOpenTrashTab={() => openTab(nav.current ?? currentDir, { trashView: true })}
          onDropInto={dropInto}
          onError={setNotice}
          onConfirm={setConfirm}
          showHidden={showHidden === true}
          tabId={activeTabId}
        />

        <main ref={mainRef} className="fw-main flex min-w-0 flex-1 flex-col bg-main">
          <Toolbar
            folderName={folderName}
            // Přeložený popisek ("Pictures") nesmí schovat, kde složka opravdu je.
            folderPath={tagFilter === null && search === null && !trashView ? nav.current : null}
            folderIcon={folderIcon}
            viewMode={viewMode}
            onViewModeChange={changeViewMode}
            query={query}
            onQueryChange={setQuery}
            onSearchSubmit={submitSearch}
            onSearchArrowDown={() =>
              // Z pole hledání šipkou dolů rovnou do výsledků.
              document.querySelector<HTMLElement>('[role="listbox"] [role="option"]')?.focus()
            }
            searchRef={searchRef}
            sortItems={toolbarSortItems}
            shareItems={toolbarShareItems}
            tagItems={toolbarTagItems}
            newItems={currentDir !== null && !overlayMode ? newMenuEntries(currentDir) : null}
            newMenuRequest={newMenuRequest}
            commands={commands}
            onMenuOpenChange={setToolbarMenuOpen}
            onNotice={showInfo}
            openWith={
              // MI-FORK
              <FolderOpenButton
                path={tagFilter === null && search === null && !trashView ? nav.current : null}
                run={(label, action) => void runOperation(label, action)}
              />
            }
            gitTools={
              // MI-FORK: rama y acciones rápidas de Git, solo dentro de un repositorio.
              // Siempre montado: con null se oculta con animación en lugar de desaparecer de golpe.
              <GitToolbarButtons
                status={tagFilter === null && search === null && !trashView ? git.status : null}
                commands={commands}
                run={git.run}
                extra={<TerminalButton path={nav.current} run={(label, action) => void runOperation(label, action)} />}
              />
            }
          />

          <TabBar
            tabs={tabs.map((tab) => ({
              id: tab.id,
              path: tab.id === activeTabId ? nav.current : tabFace(tab).nav.current,
              // MI-FORK: rozdělená záložka ukazuje oba panely (levý, pravý).
              panes:
                tab.id === activeTabId
                  ? splitOn
                    ? [panels[0].nav.current, panels[1].nav.current]
                    : undefined
                  : tab.split && tab.second
                    ? [tab.snapshot.nav.current, tab.second.nav.current]
                    : undefined,
              activePane: tab.id === activeTabId ? activePanel : (tab.activePanel ?? 0),
              closing: tab.closing === true,
              fresh: tab.fresh === true,
            }))}
            activeId={activeTabId}
            windowFocused={windowFocused}
            onSelect={switchTab}
            onClose={closeTab}
            onReorder={reorderTab}
            onDropInto={dropInto}
            newTab={commands.newTab}
            onTabMenu={(id, x, y) => setMenu({ kind: "tab", x, y, id })}
            onTabDrag={(id) => {
              setDraggedTab(id);
              setSplitDropSide(null);
            }}
          />

          <div ref={panelsBoxRef} className="fw-panels relative flex min-h-0 flex-1">
            {/* MI-FORK: zóny rozdělení při tažení ouška. Plochu panelů dělí podle
                skutečné dělicí čáry (bez rozdělení napůl); jediný náhled klouže
                na stranu pod kurzorem a ukazuje, kam se záložka otevře. */}
            {draggedTab !== null && draggedTab !== activeTabId && !narrow && (() => {
              const ratio = splitVisible ? splitRatio : 0.5;
              const dragged = openTabs.find((tab) => tab.id === draggedTab);
              const name = dragged ? tabTitle(tabFace(dragged).nav.current) : "";
              const side = splitDropSide;
              return (
                <div className={`mi-split-drop ${side !== null ? "is-armed" : ""}`} aria-hidden>
                  <div
                    className="mi-split-drop-preview"
                    style={{
                      left: side === 1 ? `${ratio * 100}%` : 0,
                      width: `${(side === 1 ? 1 - ratio : ratio) * 100}%`,
                    }}
                  >
                    <div className="mi-split-drop-chip">
                      {side === 1 ? <PanelRight size={15} strokeWidth={2} /> : <PanelLeft size={15} strokeWidth={2} />}
                      <span className="truncate">{t(side === 1 ? "split.dropRight" : "split.dropLeft", { name })}</span>
                    </div>
                  </div>
                  {([0, 1] as const).map((zone) => (
                    <div
                      key={zone}
                      className="mi-split-drop-zone"
                      style={{ flex: `0 0 ${(zone === 0 ? ratio : 1 - ratio) * 100}%` }}
                      onDragOver={(event) => {
                        if (!event.dataTransfer.types.includes(TAB_MIME)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        if (splitDropSide !== zone) setSplitDropSide(zone);
                      }}
                      onDragLeave={(event) => {
                        // Odchod mimo celou plochu (ne jen do druhé poloviny) náhled schová.
                        const into = event.relatedTarget as Node | null;
                        if (event.currentTarget.parentElement?.contains(into)) return;
                        setSplitDropSide(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = draggedTab;
                        setDraggedTab(null);
                        setSplitDropSide(null);
                        splitWithTab(id, zone);
                      }}
                    />
                  ))}
                </div>
              );
            })()}
            {folderDrag !== null && <FolderDragGhost path={folderDrag} name={folderDragName} />}
            {/* MI-FORK: zóny pro složku ze sidebaru — vlevo, nová záložka, vpravo.
                V úzkém okně (bez rozdělení) jen nová záložka. */}
            {folderDrag !== null && (() => {
              const ratio = splitVisible ? splitRatio : 0.5;
              const zone = folderDropZone;
              const zones: { id: 0 | 1 | "tab"; width: number }[] = narrow
                ? [{ id: "tab", width: 1 }]
                : [
                    { id: 0, width: 0.3 },
                    { id: "tab", width: 0.4 },
                    { id: 1, width: 0.3 },
                  ];
              const preview =
                zone === 0 ? { left: 0, width: ratio } : zone === 1 ? { left: ratio, width: 1 - ratio } : { left: 0, width: 1 };
              return (
                <div className={`mi-split-drop ${zone !== null ? "is-armed" : ""}`} aria-hidden>
                  <div
                    className="mi-split-drop-preview"
                    style={{ left: `${preview.left * 100}%`, width: `${preview.width * 100}%` }}
                  >
                    <div className="mi-split-drop-chip">
                      {zone === 0 ? (
                        <PanelLeft size={15} strokeWidth={2} />
                      ) : zone === 1 ? (
                        <PanelRight size={15} strokeWidth={2} />
                      ) : (
                        <Plus size={15} strokeWidth={2} />
                      )}
                      <span className="truncate">
                        {t(zone === 0 ? "split.dropLeft" : zone === 1 ? "split.dropRight" : "split.dropNewTab", {
                          name: folderDragName,
                        })}
                      </span>
                    </div>
                  </div>
                  {zones.map(({ id, width }) => (
                    <div
                      key={id}
                      className="mi-split-drop-zone"
                      style={{ flex: `0 0 ${width * 100}%` }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        if (folderDropZone !== id) setFolderDropZone(id);
                      }}
                      onDragLeave={(event) => {
                        const into = event.relatedTarget as Node | null;
                        if (event.currentTarget.parentElement?.contains(into)) return;
                        setFolderDropZone(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const path = folderDrag;
                        endDrag();
                        setFolderDropZone(null);
                        openFolderAt(path, id);
                      }}
                    />
                  ))}
                </div>
              );
            })()}
            {visiblePanels.map((index) => (
              <Fragment key={index}>
                {index === 1 && splitVisible && (
                  <div
                    className="fw-split-divider"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t("split.divider")}
                    onPointerDown={startSplitResize}
                    onDoubleClick={() => void storage.setSplitRatio(0.5)}
                  />
                )}
                {renderPanel(index)}
              </Fragment>
            ))}
            {/* MI-FORK: panel informací vpravo — vybraná položka, bez výběru
                aktuální složka. Sloupcové zobrazení má vlastní v posledním sloupci. */}
            {(infoOpen || infoClosing) && !isColumnView && infoEntry !== null && (
              <div
                className={`mi-info-dock ${infoClosing ? "is-closing" : ""}`}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget && infoClosing) setInfoClosing(false);
                }}
              >
                <InfoPanel
                  key={infoEntry.path}
                  entry={infoEntry}
                  onOpen={(entry) => (entry.is_dir ? navigate(entry.path) : openFile(entry))}
                  tags={tags}
                  onPreview={() => setQuickLookOpen(true)}
                />
              </div>
            )}
          </div>

          {/* MI-FORK: rychlé přepínače dole v hlavní ploše, nad status barem. */}
          <QuickBar
            showHidden={showHidden === true}
            onToggleHidden={toggleHidden}
            previewOpen={quickLookShown}
            onPreview={
              activeEntry !== null && !activeEntry.is_dir
                ? () => setQuickLookOpen((open) => !open)
                : null}
            infoOpen={infoOpen}
            onInfo={isColumnView ? null : toggleInfo}
          />
        </main>
      </div>

      {update && updateBarShown && (
        <div className="fw-update-bar" role="status">
          <span className="min-w-0 truncate">{t("update.available", { version: update.version })}</span>
          <button
            type="button"
            className="fw-update-link"
            onClick={() =>
              shellLauncher.get().openReleasePage(update.url).catch((err: unknown) =>
                setNotice(failure("op.openRelease", err), errorDetail(err)),
              )
            }
          >
            {t("update.download")}
          </button>
          <button
            type="button"
            aria-label={t("update.dismiss")}
            data-tooltip={t("update.dismiss")}
            onClick={() => setUpdate(null)}
            className="ml-auto shrink-0 text-secondary hover:text-primary"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <StatusBar
        path={currentDir}
        itemCount={statusVisibleCount}
        streamingCount={isColumnView || inSearch || inTagView ? null : streamingCount}
        totalCount={statusTotalCount}
        // Ve výsledcích hledání a v tag view je dotaz celek, ne filtr —
        // jinak by status hlásil "12 z 12 (filtr)".
        filtered={needle.length > 0 && !inSearch && !inTagView}
        selectedCount={statusSelectedCount}
        freeSpace={freeSpace}
        onNavigate={navigate}
        editing={pathEditing}
        onEditingChange={setPathEditing}
        onContextMenu={openStatusMenu}
        onCopyPath={() => {
          if (currentDir !== null) copyText(currentDir, "op.copyPath");
        }}
        // MI-FORK: rama de Git en la barra de estado.
        git={git.status}
        onGitClick={() => git.setDialogOpen(true)}
      />

      {notice && (
        <Toast
          notice={notice}
          expanded={noticeExpanded}
          closing={noticeClosing}
          onClose={closeNotice}
          onToggleDetail={toggleNoticeDetail}
        />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}

      {conflict && (
        <ConflictDialog
          {...conflict.request}
          onAnswer={(answer) => {
            setConflict(null);
            conflict.resolve(answer);
          }}
          onCancel={() => {
            setConflict(null);
            conflict.resolve(null);
          }}
        />
      )}

      {propertiesFor && (
        <PropertiesDialog entry={propertiesFor} onClose={() => setPropertiesFor(null)} />
      )}

      {paletteOpen && (
        <CommandPalette
          commands={Object.values(commands).filter((command) => command.palette && command.enabled)}
          extraActions={paletteNewActions}
          folders={paletteFolders}
          recentFolders={recents.filter((item) => item.type === "folder").map((item) => item.path)}
          usage={commandUsage}
          onClose={() => setPaletteOpen(false)}
          onOpenFolder={(path) => {
            void storage.addRecent(path, storage.lastSegment(path), "folder");
            navigate(path);
          }}
          onGoToPath={(text) => void goToTypedPath(text)}
          onSelectTag={selectTag}
          onSearchFiles={(text) => {
            if (currentDir === null) return;
            setQuery(text);
            setTagFilter(null);
            setTrashView(false);
            setComputerView(false);
            setOverlaySelected(null);
            setSearch({ root: currentDir, query: text });
          }}
          onRunCommand={(command) => {
            // Počítají se jen spuštění z palety — podle nich se nabízí
            // „nejpoužívanější" akce (zkratky typu Ctrl+C by je přebily).
            void storage.countCommand(command.id);
            command.run();
          }}
        />
      )}

      {aboutOpen && (
        <AboutDialog onClose={() => setAboutOpen(false)} />
      )}

      {/* MI-FORK: Git integrado. */}
      {extras.dialogs /* MI-FORK */}
      {git.dialogOpen && git.status && (
        <GitDialog status={git.status} onClose={() => git.setDialogOpen(false)} />
      )}

      {quickLookOpen && activeEntry && !activeEntry.is_dir && (
        <QuickLook
          entries={previewEntries}
          entry={activeEntry}
          onClose={() => setQuickLookOpen(false)}
          onOpenFile={openFile}
          onContextMenu={openQuickLookMenu}
          onCurrentChange={syncQuickLookSelection}
        />
      )}

      {overlayPreview && (
        <QuickLook
          entries={[overlayPreview]}
          entry={overlayPreview}
          onClose={() => setOverlayPreview(null)}
          onOpenFile={openFile}
          onContextMenu={openQuickLookMenu}
        />
      )}

      <TooltipLayer />
    </div>
  );
}
