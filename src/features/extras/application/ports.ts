import { definePort } from "../../../shared/application/port";
import type { Archives } from "../domain/ports";

export const archives = definePort<Archives>("Archives");
