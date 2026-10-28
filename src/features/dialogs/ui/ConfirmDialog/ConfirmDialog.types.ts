export type ConfirmRequest = {
  title: string;
  message: string;
  /** Text potvrzovacího tlačítka ("Smazat trvale", "Vymazat"). */
  confirmLabel: string;
  /** Nevratná akce — tlačítko je červené. */
  danger?: boolean;
  onConfirm: () => void;
};

export type ConfirmDialogProps = ConfirmRequest & {
  onClose: () => void;
};
