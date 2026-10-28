import type { GitStatus } from "../../../git/domain/git.types";

export type StatusBarProps = {
  path: string | null;
  /** Počet po filtru. */
  itemCount: number;
  /** Počet ve složce bez filtru. */
  totalCount: number;
  /** Velká složka se ještě dočítá — kolik položek zatím dorazilo. */
  streamingCount?: number | null;
  filtered: boolean;
  /** Kolik položek je vybraných; 0 = ukazuje se jen počet. */
  selectedCount: number;
  freeSpace: number | null;
  onNavigate: (path: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** Pravý klik kamkoliv do lišty mimo editaci cesty. */
  onContextMenu: (x: number, y: number) => void;
  /** Zkopíruje aktuální cestu do schránky. */
  onCopyPath: () => void;
  /** MI-FORK: repo, ve kterém složka leží (větev vpravo); null mimo repo. */
  git?: GitStatus | null;
  onGitClick?: () => void;
};

/** MI-FORK: rychlé přepínače — skryté soubory, náhled, vlastnosti. */
export type QuickBarProps = {
  showHidden: boolean;
  onToggleHidden: () => void;
  previewOpen: boolean;
  /** null = vybraná položka náhled nemá (složka, nic vybráno). */
  onPreview: (() => void) | null;
  /** Panel informací vpravo je otevřený. */
  infoOpen: boolean;
  /** null = zobrazení má vlastní panel (sloupce). */
  onInfo: (() => void) | null;
};
