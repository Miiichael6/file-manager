import { definePort } from "../../../shared/application/port";
import type { Drives } from "../domain/ports";

export const drives = definePort<Drives>("Drives");
