import { useCallback, useEffect, useState } from "react";

import type { MenuItem } from "../../../shared/ui/ContextMenu";
import { useT } from "../../../shared/i18n/index";
import type { ShellIntegrationKind, ShellIntegrationState } from "../domain/ports";
import { shellIntegration } from "./ports";

/*
 * MI-FORK: Más → Integración con Windows (src-tauri/src/mi_cli.rs).
 * - «Comando file-manager en la terminal»: carpeta del .exe en el PATH de usuario,
 * - «Abrir en File Manager» en el menú contextual del Explorador.
 * El estado vive en el registro (HKCU), no en settings.json: se lee al montar y
 * tras cada cambio. El desinstalador lo quita (`file-manager.exe --unregister`).
 */

export function useShellIntegration(): MenuItem {
  const t = useT();
  const [state, setState] = useState<ShellIntegrationState | null>(null);

  const reload = useCallback(() => {
    void shellIntegration
      .get()
      .read()
      .then(setState)
      .catch(() => setState(null));
  }, []);
  useEffect(reload, [reload]);

  const toggle = (kind: ShellIntegrationKind) => {
    const enabled = !state?.[kind];
    void shellIntegration
      .get()
      .set(kind, enabled, t("shellIntegration.explorerLabel"))
      .catch((err: unknown) => console.error("set_shell_integration", err))
      .finally(reload);
  };

  return {
    type: "submenu",
    label: t("shellIntegration.menu"),
    items: [
      {
        type: "item",
        label: t("shellIntegration.path"),
        tooltip: t("shellIntegration.pathHint"),
        checked: state?.path === true,
        disabled: state === null,
        onSelect: () => toggle("path"),
      },
      {
        type: "item",
        label: t("shellIntegration.contextMenu"),
        checked: state?.contextMenu === true,
        disabled: state === null,
        onSelect: () => toggle("contextMenu"),
      },
    ],
  };
}
