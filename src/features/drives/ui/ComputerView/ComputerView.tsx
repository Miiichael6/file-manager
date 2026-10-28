// MI-FORK: vista «Este equipo» — una tarjeta por unidad con espacio libre, barra por umbrales y acciones.
import { useEffect, useMemo } from "react";
import { ExternalLink, FolderOpen, HardDrive } from "lucide-react";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { sidebarIcon, sidebarLabel } from "../../../../shared/ui/icons";
import { formatSize } from "../../../../shared/domain/format";
import { useT } from "../../../../shared/i18n/index";
import type { FavoriteSection } from "../../../../shared/domain/types";
import { useDriveUsage } from "../DriveUsage";
import "./computer-view.css";

/** Hasta el 80 % de uso la barra es azul, hasta el 92 % ámbar y a partir de ahí roja. */
const WARN_RATIO = 0.8;
const FULL_RATIO = 0.92;

type Level = "ok" | "warn" | "full";

function levelFor(ratio: number): Level {
  if (ratio >= FULL_RATIO) return "full";
  if (ratio >= WARN_RATIO) return "warn";
  return "ok";
}

type ComputerViewProps = {
  sections: FavoriteSection[];
  /** Ahora mismo no cambia el aspecto; se deja por coherencia con las otras vistas. */
  windowFocused: boolean;
  onOpen: (path: string) => void;
  onOpenTab: (path: string) => void;
  /** Para que la barra de estado cuente unidades y no la carpeta de debajo. */
  onCountChange: (count: number) => void;
};

export function ComputerView({ sections, windowFocused, onOpen, onOpenTab, onCountChange }: ComputerViewProps) {
  const t = useT();
  const drives = useMemo(
    () =>
      sections
        .filter((section) => section.id === "devices")
        .flatMap((section) => section.items.filter((item) => item.letter !== null && !item.external)),
    [sections],
  );
  const usageOf = useDriveUsage(useMemo(() => drives.map((item) => item.path), [drives]));

  useEffect(() => onCountChange(drives.length), [drives.length, onCountChange]);

  if (drives.length === 0) return <EmptyState Icon={HardDrive} title={t("computer.empty")} />;

  return (
    <div className={`fw-computer ${windowFocused ? "" : "is-inactive"}`}>
      <h2 className="fw-computer-heading">
        {t("computer.drives")} <span>{drives.length}</span>
      </h2>
      <div className="fw-computer-grid">
        {drives.map((item) => {
          const Icon = sidebarIcon(item.icon_name);
          const usage = usageOf(item.path);
          const ratio = usage ? Math.min(1, Math.max(0, (usage.total - usage.free) / usage.total)) : 0;
          const level = levelFor(ratio);
          const used = usage ? usage.total - usage.free : 0;
          return (
            <div
              key={item.path}
              role="button"
              tabIndex={0}
              className={`fw-drive-card is-${level}`}
              data-tooltip={usage ? t("computer.breakdown", { used: formatSize(used, false), free: formatSize(usage.free, false) }) : item.path}
              onDoubleClick={() => onOpen(item.path)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onOpen(item.path);
              }}
              onAuxClick={(event) => {
                if (event.button === 1) onOpenTab(item.path);
              }}
            >
              <div className="fw-drive-card-head">
                <Icon size={18} strokeWidth={1.75} />
                <span className="fw-drive-card-name">{sidebarLabel(item)}</span>
              </div>
              {usage ? (
                <>
                  <div className="fw-drive-card-free">{t("computer.free", { free: formatSize(usage.free, false) })}</div>
                  <div className="fw-drive-card-total">{t("computer.ofTotal", { total: formatSize(usage.total, false) })}</div>
                  <div className="fw-drive-card-bar" aria-hidden>
                    <div style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                  <div className="fw-drive-card-foot">
                    <span>{Math.round(ratio * 100)} %</span>
                    {level !== "ok" && <span className="fw-drive-card-alert">{t("computer.low")}</span>}
                  </div>
                </>
              ) : (
                <div className="fw-drive-card-total">{item.path}</div>
              )}
              <div className="fw-drive-card-actions">
                <button type="button" onClick={() => onOpen(item.path)}>
                  <FolderOpen size={13} strokeWidth={1.75} />
                  {t("computer.open")}
                </button>
                <button type="button" onClick={() => onOpenTab(item.path)}>
                  <ExternalLink size={13} strokeWidth={1.75} />
                  {t("computer.openTab")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
