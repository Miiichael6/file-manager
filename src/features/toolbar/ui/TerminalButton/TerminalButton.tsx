import { useEffect, useState } from "react";
import { ChevronDown, SquareTerminal } from "lucide-react";

import { ContextMenu, type MenuItem } from "../../../../shared/ui/ContextMenu";
import { availableTerminals, openTerminal, type TerminalId } from "../../../../shared/application/fileops";
import type { MessageKey } from "../../../../shared/i18n/index";
import { useT } from "../../../../shared/i18n/index";
import * as storage from "../../../../shared/infrastructure/storage";
import { useStorage } from "../../../../shared/lib/useStorage";
import "../FolderOpenButton/folder-open.css";

/*
 * MI-FORK: botón partido «Abrir terminal» en la barra, junto a los de Git
 * (solo en un repositorio). Como «Abrir con» (FolderOpenButton.tsx): clic en
 * el icono = abrir la carpeta actual en la terminal predeterminada; la flecha
 * despliega las terminales instaladas y la elegida pasa a ser la
 * predeterminada (la misma opción que Más → Terminal, en settings.json).
 */

const LABELS: Record<TerminalId, MessageKey> = {
  windowsTerminal: "terminal.windowsTerminal",
  pwsh: "terminal.pwsh",
  powershell: "terminal.powershell",
  cmd: "terminal.cmd",
};

type Props = {
  /** Carpeta actual; null = no hay carpeta real. */
  path: string | null;
  /** runOperation de App.tsx (aviso de error traducido). */
  run: (label: MessageKey, action: () => Promise<unknown>) => void;
};

export function TerminalButton({ path, run }: Props) {
  const t = useT();
  const { terminal } = useStorage();
  const [installed, setInstalled] = useState<TerminalId[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void availableTerminals().then(setInstalled);
  }, []);

  // «Automático» = Windows Terminal y, si no está, Windows PowerShell (main.rs).
  const current: TerminalId =
    terminal !== "auto" ? terminal : installed.length === 0 || installed.includes("windowsTerminal") ? "windowsTerminal" : "powershell";
  const label = t("terminal.openIn", { terminal: t(LABELS[current]) });

  if (path === null) return null;

  function toggleMenu(event: React.MouseEvent<HTMLElement>) {
    // mousedown + stopPropagation, como los demás menús de la barra.
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.closest(".mi-open-btn")!.getBoundingClientRect();
    setMenu((open) => (open ? null : { x: rect.left, y: rect.bottom + 4 }));
  }

  const items: MenuItem[] = installed.map((id) => ({
    type: "item",
    label: t(LABELS[id]),
    checked: id === current,
    onSelect: () => {
      void storage.setTerminal(id);
      run("op.terminal", () => openTerminal(path, id));
    },
  }));

  return (
    <div className={`mi-open-btn mi-terminal-btn ${menu ? "is-open" : ""}`}>
      <button
        type="button"
        aria-label={label}
        data-tooltip={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => run("op.terminal", () => openTerminal(path, current))}
        className="fw-tool-btn mi-open-main"
      >
        <SquareTerminal size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={t("terminal.choose")}
        data-tooltip={t("terminal.choose")}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        data-mi-terminal-trigger
        onMouseDown={toggleMenu}
        className="fw-tool-btn mi-open-arrow"
      >
        <ChevronDown size={12} strokeWidth={2} />
      </button>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={items}
          onClose={() => setMenu(null)}
          triggerSelector="[data-mi-terminal-trigger]"
          dropdown
        />
      )}
    </div>
  );
}
