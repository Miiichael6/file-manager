export type DialogAction = {
  label: string;
  onClick: () => void;
  /** primary = akcent a Enter; danger = červené, Enter ho NIKDY nespustí. */
  kind?: "primary" | "danger" | "secondary";
  disabled?: boolean;
  /** Tlačítko s fokusem po otevření (jinak dostane fokus celý dialog). */
  autoFocus?: boolean;
};

export type DialogProps = {
  /** Přístupný název dialogu, když nemá viditelný nadpis s id. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  /** alertdialog = potvrzení / varování, dialog = informace. */
  role?: "dialog" | "alertdialog";
  width?: number;
  onClose: () => void;
  /** Tlačítka vpravo, v pořadí zleva doprava. */
  actions: DialogAction[];
  /** Tlačítko vlevo (Zastavit u kolize). */
  leftAction?: DialogAction;
  /** Klik na podklad zavře (u rozhodovacích dialogů ne). */
  closeOnOverlay?: boolean;
  children: React.ReactNode;
};
