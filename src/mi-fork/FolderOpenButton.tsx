import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { ContextMenu } from "../components/ContextMenu";
import { statPaths } from "../fileops";
import type { MessageKey } from "../i18n";
import { useT } from "../i18n";
import "./folder-open.css";
import { defaultFolderApp, folderAppIcon, folderOpenWithMenu, openFolderWith, useFolderApps } from "./folderApps";

/*
 * MI-FORK: botón de la barra «Abrir carpeta con». Clic en el icono = abrir la
 * carpeta actual en la última app usada (VS Code…); la flecha despliega el
 * submenú completo (las demás apps + «Elegir otra aplicación…»). Solo aparece
 * en carpetas con .git (un repositorio) y si hay algún editor instalado o
 * elegido antes.
 */

type Props = {
  /** Carpeta actual; null = no hay carpeta real (etiquetas, búsqueda, Papelera). */
  path: string | null;
  /** runOperation de App.tsx (aviso de error traducido). */
  run: (label: MessageKey, action: () => Promise<unknown>) => void;
};

export function FolderOpenButton({ path, run }: Props) {
  const t = useT();
  const apps = useFolderApps();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const app = defaultFolderApp(apps);
  /** Carpeta actual si tiene .git (carpeta, o archivo en worktrees y submódulos). */
  const [repo, setRepo] = useState<string | null>(null);

  useEffect(() => {
    if (path === null) return;
    let active = true;
    const git = path.endsWith("\\") ? `${path}.git` : `${path}\\.git`;
    statPaths([git])
      .then(([result]) => {
        if (active) setRepo(result?.entry ? path : null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [path]);

  function toggleMenu(event: React.MouseEvent<HTMLElement>) {
    // Como los menús del Toolbar: mousedown + stopPropagation, si no el
    // ContextMenu se cerraría y volvería a abrir con el mismo clic.
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.closest(".mi-open-btn")!.getBoundingClientRect();
    setMenu((current) => (current ? null : { x: rect.left, y: rect.bottom + 4 }));
  }

  if (!app || path === null || repo !== path) return null;
  const icon = folderAppIcon(app);
  const label = t("folderApps.openIn", { app: app.name });

  return (
    <div className={`mi-open-btn ${menu ? "is-open" : ""}`}>
      <button
        type="button"
        aria-label={label}
        data-tooltip={label}
        // Sin foco, como los demás botones de la barra (flechas en la lista).
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (path !== null) run("op.openFolderWith", () => openFolderWith(app, path));
        }}
        className="fw-tool-btn mi-open-main"
      >
        {icon ? <img src={icon} width={16} height={16} alt="" /> : <span className="mi-open-letter">{app.name[0]}</span>}
      </button>
      <button
        type="button"
        aria-label={t("folderApps.button")}
        data-tooltip={t("folderApps.button")}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        data-mi-open-trigger
        onMouseDown={toggleMenu}
        className="fw-tool-btn mi-open-arrow"
      >
        <ChevronDown size={12} strokeWidth={2} />
      </button>

      {menu && path !== null && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={(() => {
            const submenu = folderOpenWithMenu(path, apps, t, run, false);
            return submenu.type === "submenu" ? submenu.items : [submenu];
          })()}
          onClose={() => setMenu(null)}
          triggerSelector="[data-mi-open-trigger]"
        />
      )}
    </div>
  );
}
