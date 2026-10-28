import type { LucideIcon } from "lucide-react";
import type { ViewMode } from "../../../../shared/domain/types";
import type { MenuItem } from "../../../../shared/ui/ContextMenu";
import type { Commands } from "../../../command-palette/domain/commands.types";

export type IconButtonProps = {
  Icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Tlačítka otevírající menu potřebují mousedown — viz komentář u "Více". */
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Třída na samotnou ikonu, kvůli animaci uvnitř nehybného tlačítka. */
  iconClassName?: string;
  /** Nedostupná akce s vysvětlením ("Vyberte soubor") v tooltipu a po kliknutí
   *  v hlášce (onUnavailable). Vzhled zůstává plný jako u ostatních nástrojů;
   *  obyčejné `disabled` by tooltip nedovolilo — vypnutý button nedostává myš. */
  unavailable?: string;
  onUnavailable?: (message: string) => void;
  /** Otevírá menu — kontextové menu ho při kliknutí mimo sebe nechá být. */
  menuTrigger?: boolean;
};

export type ToolbarProps = {
  folderName: string;
  /** Skutečná cesta pro tooltip záhlaví; null v tag view a výsledcích hledání. */
  folderPath: string | null;
  /** Malá ikona před názvem — stejná jako u složky v sidebaru. */
  folderIcon: React.ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Enter v poli — filtr aktuální složky se povýší na rekurzivní hledání. */
  onSearchSubmit: () => void;
  /** ↓ v poli hledání — přesun do výsledků. */
  onSearchArrowDown: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  /** Položky menu Seřadit / Sdílet / Štítky — sestavuje je App, zná výběr. */
  sortItems: MenuItem[];
  shareItems: MenuItem[];
  /** null = nic není vybrané, tlačítko Štítky je vypnuté. */
  tagItems: MenuItem[] | null;
  /** Menu tlačítka Nový (Složka, Textový dokument, typy z registru); null = nejde (tag view, hledání). */
  newItems: MenuItem[] | null;
  /** Zvýšení čísla otevře menu Nový — příkaz newItem z palety a klávesnice. */
  newMenuRequest: number;
  /** Registr příkazů (commands.ts) — tlačítka i menu Více z něj berou akce,
   *  stav i zkratky, takže se s klávesnicí a paletou nerozejdou. */
  commands: Commands;
  /** Otevřené menu musí App znát kvůli globálním zkratkám (modalOpen). */
  onMenuOpenChange: (open: boolean) => void;
  /** Krátká hláška nad status barem (klik na nedostupné Štítky). */
  onNotice: (message: string) => void;
  /** MI-FORK: botón «Abrir carpeta con» (src/mi-fork/FolderOpenButton.tsx). */
  openWith?: React.ReactNode;
  /** MI-FORK: botones de Git (src/mi-fork/GitToolbarButtons.tsx); solo en un repositorio. */
  gitTools?: React.ReactNode;
};

export type ToolbarMenu = "new" | "sort" | "share" | "tags" | "more";
