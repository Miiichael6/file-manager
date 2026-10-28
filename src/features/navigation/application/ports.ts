import { definePort } from "../../../shared/application/port";
import type { JumpList } from "../domain/ports";

export const jumpList = definePort<JumpList>("JumpList");
