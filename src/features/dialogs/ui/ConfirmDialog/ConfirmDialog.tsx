import { Dialog } from "../../../../shared/ui/Dialog";
import { useT } from "../../../../shared/i18n/index";
import type { ConfirmDialogProps } from "./ConfirmDialog.types";

/**
 * Potvrzení nevratné akce. U nebezpečné akce má fokus Zrušit a Enter ji
 * nespustí — Enter omylem stisknutý hned po Delete nesmí nic trvale smazat.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const t = useT();
  const confirm = () => {
    onClose();
    onConfirm();
  };

  return (
    <Dialog
      role="alertdialog"
      labelledBy="fw-confirm-title"
      describedBy="fw-confirm-message"
      onClose={onClose}
      actions={[
        { label: t("common.cancel"), onClick: onClose, autoFocus: danger },
        danger
          ? { label: confirmLabel, onClick: confirm, kind: "danger" }
          : { label: confirmLabel, onClick: confirm, kind: "primary", autoFocus: true },
      ]}
    >
      <p id="fw-confirm-title" className="text-[14px] font-semibold">
        {title}
      </p>
      <p id="fw-confirm-message" className="leading-relaxed break-words text-secondary">
        {message}
      </p>
    </Dialog>
  );
}
