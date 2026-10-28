import { definePort } from "../../../shared/application/port";
import type { WindowChrome } from "../domain/ports";

export const windowChrome = definePort<WindowChrome>("WindowChrome");
