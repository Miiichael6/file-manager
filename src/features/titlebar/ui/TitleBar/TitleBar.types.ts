export type CaptionButtonProps = {
  glyph: string;
  label: string;
  onClick: () => void;
  className?: string;
  /** Tooltip jen tam, kde ho neukáže systém (Maximalizovat má Snap Layouts). */
  tooltip?: boolean;
};
