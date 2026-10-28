import type { Notice } from "../../application/useNotice.types";

export type Props = {
  notice: Notice;
  expanded: boolean;
  closing: boolean;
  onClose: () => void;
  onToggleDetail: () => void;
};
