/** Stav nativního tlačítka Maximalizovat pod overlayem Snap Layouts (snap.rs). */
export type SnapButtonState = "none" | "hover" | "pressed";

/** Ovládání okna z vlastního titulkového pruhu. */
export interface WindowControls {
  isMaximized(): Promise<boolean>;
  onResized(handler: () => void): Promise<() => void>;
  onSnapButton(handler: (state: SnapButtonState) => void): Promise<() => void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
}
