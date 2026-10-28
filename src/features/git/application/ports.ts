import { definePort } from "../../../shared/application/port";
import type { GitRepository } from "../domain/ports";

export const gitRepository = definePort<GitRepository>("GitRepository");
