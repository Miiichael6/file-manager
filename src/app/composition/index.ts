/**
 * Kořen kompozice (hexagonální architektura): jediné místo, kde se portům
 * aplikační vrstvy dosazují adaptéry z infrastruktury.
 *
 * Adaptéry se dosadí už při načtení modulu — main.tsx ho importuje jako
 * první, protože některé moduly aplikační vrstvy sahají na porty hned při
 * importu (načtení vlastních klíčů settings.json).
 */
import { fileSystem, fileUrls, settingsStore, shellImages, textClipboard } from "../../shared/application/ports";
import {
  tauriFileSystem,
  tauriFileUrls,
  tauriSettingsStore,
  tauriShellImages,
  tauriTextClipboard,
} from "../../shared/infrastructure/tauriShared";
import { gitRepository } from "../../features/git/application/ports";
import { tauriGitRepository } from "../../features/git/infrastructure/tauriGitRepository";
import { windowChrome } from "../../features/theme/application/ports";
import { tauriWindowChrome } from "../../features/theme/infrastructure/tauriWindowChrome";
import { folderApps, shellIntegration } from "../../features/toolbar/application/ports";
import { tauriFolderApps, tauriShellIntegration } from "../../features/toolbar/infrastructure/tauriToolbar";
import { jumpList } from "../../features/navigation/application/ports";
import { tauriJumpList } from "../../features/navigation/infrastructure/tauriJumpList";
import { explorerExtensions, folderSizes, nativeDrag } from "../../features/file-list/application/ports";
import {
  tauriExplorerExtensions,
  tauriFolderSizes,
  tauriNativeDrag,
} from "../../features/file-list/infrastructure/tauriFileList";

function composeApp(): void {
  fileSystem.provide(tauriFileSystem);
  shellImages.provide(tauriShellImages);
  settingsStore.provide(tauriSettingsStore);
  textClipboard.provide(tauriTextClipboard);
  fileUrls.provide(tauriFileUrls);

  gitRepository.provide(tauriGitRepository);
  windowChrome.provide(tauriWindowChrome);
  folderApps.provide(tauriFolderApps);
  shellIntegration.provide(tauriShellIntegration);
  jumpList.provide(tauriJumpList);
  explorerExtensions.provide(tauriExplorerExtensions);
  folderSizes.provide(tauriFolderSizes);
  nativeDrag.provide(tauriNativeDrag);
}

composeApp();
