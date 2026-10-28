/**
 * Kořen kompozice (hexagonální architektura): jediné místo, kde se portům
 * aplikační vrstvy dosazují adaptéry z infrastruktury.
 *
 * Adaptéry se dosadí už při načtení modulu — main.tsx ho importuje jako
 * první, protože některé moduly aplikační vrstvy sahají na porty hned při
 * importu (načtení vlastních klíčů settings.json).
 */
import {
  dirWatcher,
  fileSystem,
  fileUrls,
  settingsStore,
  shellImages,
  shellLauncher,
  systemPlaces,
  textClipboard,
} from "../../shared/application/ports";
import {
  tauriDirWatcher,
  tauriFileSystem,
  tauriFileUrls,
  tauriSettingsStore,
  tauriShellImages,
  tauriShellLauncher,
  tauriSystemPlaces,
  tauriTextClipboard,
} from "../../shared/infrastructure/tauriShared";
import { gitRepository } from "../../features/git/application/ports";
import { tauriGitRepository } from "../../features/git/infrastructure/tauriGitRepository";
import { windowChrome } from "../../features/theme/application/ports";
import { tauriWindowChrome } from "../../features/theme/infrastructure/tauriWindowChrome";
import { folderApps, shellIntegration } from "../../features/toolbar/application/ports";
import { tauriFolderApps, tauriShellIntegration } from "../../features/toolbar/infrastructure/tauriToolbar";
import { drives } from "../../features/drives/application/ports";
import { tauriDrives } from "../../features/drives/infrastructure/tauriDrives";
import { archives } from "../../features/extras/application/ports";
import { tauriArchives } from "../../features/extras/infrastructure/tauriArchives";
import { windowControls } from "../../features/titlebar/application/ports";
import { tauriWindowControls } from "../../features/titlebar/infrastructure/tauriWindowControls";
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
  shellLauncher.provide(tauriShellLauncher);
  dirWatcher.provide(tauriDirWatcher);
  systemPlaces.provide(tauriSystemPlaces);

  gitRepository.provide(tauriGitRepository);
  windowChrome.provide(tauriWindowChrome);
  folderApps.provide(tauriFolderApps);
  shellIntegration.provide(tauriShellIntegration);
  jumpList.provide(tauriJumpList);
  explorerExtensions.provide(tauriExplorerExtensions);
  folderSizes.provide(tauriFolderSizes);
  nativeDrag.provide(tauriNativeDrag);
  drives.provide(tauriDrives);
  archives.provide(tauriArchives);
  windowControls.provide(tauriWindowControls);
}

composeApp();
