import type { DropInto } from "../../../file-list/application/rowDnd.types";
import type { Command } from "../../../command-palette/domain/commands.types";

export type TabItem = {
  id: number;
  path: string | null;
  /** MI-FORK: rozdělená záložka — složky levého a pravého panelu. */
  panes?: [string | null, string | null];
  /** Aktivní panel rozdělené záložky. */
  activePane?: 0 | 1;
  closing: boolean;
  /** Právě otevřená — vjede animací. */
  fresh: boolean;
};

export type TabBarProps = {
  tabs: TabItem[];
  activeId: number;
  windowFocused: boolean;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  /** Přetažení záložky na místo jiného ouška — `index` je pozice v poli záložek. */
  onReorder: (id: number, index: number) => void;
  /** Položky (i soubory z Průzkumníku) puštěné na záložku — přesun do její složky. */
  onDropInto: DropInto;
  /** Příkaz Nová záložka z registru — + za posledním ouškem, totéž co Ctrl+T. */
  newTab: Command;
  /** MI-FORK: tažené ouško (null = konec tažení) — App podle něj ukáže zóny rozdělení nad panely. */
  onTabDrag?: (id: number | null) => void;
  /** MI-FORK: pravý klik na ouško — menu záložky. */
  onTabMenu?: (id: number, x: number, y: number) => void;
};
