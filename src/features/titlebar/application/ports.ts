import { definePort } from "../../../shared/application/port";
import type { WindowControls } from "../domain/ports";

export const windowControls = definePort<WindowControls>("WindowControls");
