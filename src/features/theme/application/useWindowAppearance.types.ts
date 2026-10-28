import type { ThemePreference } from "./theme.types";
import type { TransparencyStrength } from "../../../shared/infrastructure/storage.types";

export type Options = {
  themePreference: ThemePreference;
  windowTransparency: boolean;
  transparencyStrength: TransparencyStrength;
};
