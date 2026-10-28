import type { FileEntry } from "../../../../shared/domain/types";
import type { EmptyState } from "../../../../shared/ui/EmptyState";

export type ResultsViewProps = {
  entries: FileEntry[];
  /** První načtení — dokud nic nedorazilo, ukazuje se "Načítám…". */
  loading: boolean;
  loadingMessage: string;
  error: string | null;
  /** Prázdný stav — ikona, nadpis a nápověda. */
  empty: React.ComponentProps<typeof EmptyState>;
  /** Kořen hledání. Se ním je "Kde je" relativně k němu, bez něj plná cesta. */
  root?: string;
  /** Patička pod výsledky ("Zobrazeno prvních 500 výsledků."). */
  footer?: React.ReactNode;
  windowFocused: boolean;
  /** Výběr drží App — potřebuje ho pro Ctrl+C a kontextové menu. */
  selectedPath: string | null;
  onSelectionChange: (entry: FileEntry | null) => void;
  /** Dvojklik — složka se otevře, soubor spustí výchozí aplikací. */
  onOpen: (entry: FileEntry) => void;
  /** Pravý klik — stejné menu jako u běžné položky (včetně Zobrazit ve složce). */
  onContextMenu: (entry: FileEntry, x: number, y: number) => void;
  /** Ať status bar hlásí počet výsledků, ne obsah podkladové složky. */
  onCountChange: (count: number) => void;
};
