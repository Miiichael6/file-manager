// MI-FORK: dona de ocupación junto a cada unidad del sidebar («Disco local (C:)»).
import { useEffect, useState } from "react";
import { invoke } from "../fileops";
import { formatSize } from "../format";
import type { Translate } from "../i18n";
import * as storage from "../lib/storage";
import "./drive-usage.css";

export type DriveUsage = { path: string; total: number; free: number };

/** Al 90 % la dona pasa a rojo, como la barra de Este equipo en el Explorador. */
const FULL_RATIO = 0.9;
const REFRESH_MS = 60_000;

/**
 * Uso de las unidades `paths`; se refresca al cambiar la lista, cada minuto
 * y al volver a la ventana (tras copiar algo grande fuera de la app).
 */
export function useDriveUsage(paths: string[]): (path: string) => DriveUsage | undefined {
  const [usage, setUsage] = useState<DriveUsage[]>([]);
  const key = paths.join("|");

  useEffect(() => {
    if (paths.length === 0) {
      setUsage([]);
      return;
    }
    let alive = true;
    const load = () =>
      void invoke<DriveUsage[]>("drive_usage", { paths })
        .then((result) => alive && setUsage(result))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (path) => usage.find((item) => storage.samePath(item.path, path));
}

/** «120 GB libres de 476 GB» — para el tooltip de la fila. */
export function driveUsageText(usage: DriveUsage, t: Translate): string {
  return t("drive.usage", { free: formatSize(usage.free, false), total: formatSize(usage.total, false) });
}

const RADIUS = 5.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DriveDonut({ usage }: { usage: DriveUsage }) {
  const ratio = Math.min(1, Math.max(0, (usage.total - usage.free) / usage.total));
  return (
    <svg
      className={`fw-drive-donut ${ratio >= FULL_RATIO ? "is-full" : ""}`}
      width={14}
      height={14}
      viewBox="0 0 14 14"
      aria-hidden
    >
      <circle className="fw-drive-donut-track" cx={7} cy={7} r={RADIUS} />
      <circle
        className="fw-drive-donut-fill"
        cx={7}
        cy={7}
        r={RADIUS}
        strokeDasharray={`${ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}
