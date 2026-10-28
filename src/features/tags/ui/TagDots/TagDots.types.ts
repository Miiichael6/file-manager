import type { TagColor } from "../../../../shared/domain/types";

export type TagDotsProps = {
  colors: TagColor[];
  /** Průměr puntíku v px — 8 v icon a list view, 6 v column view. */
  size?: number;
};
