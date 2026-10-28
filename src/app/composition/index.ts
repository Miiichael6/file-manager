/**
 * Kořen kompozice (hexagonální architektura): jediné místo, kde se portům
 * aplikační vrstvy dosazují adaptéry z infrastruktury. Volá se v main.tsx
 * před prvním renderem.
 */
import { gitRepository } from "../../features/git/application/ports";
import { tauriGitRepository } from "../../features/git/infrastructure/tauriGitRepository";

export function composeApp(): void {
  gitRepository.provide(tauriGitRepository);
}
