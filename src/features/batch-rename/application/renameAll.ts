import { renamePath } from "../../../shared/application/fileops";
import * as storage from "../../../shared/infrastructure/storage";
import type { Renamed } from "../domain/batchRename.types";

/* MI-FORK: ejecución del renombrado por lotes (el cálculo está en domain/batchRename.ts). */

/**
 * Renombra cada `from` a `to` (rutas completas en la misma carpeta). Si algún
 * nombre nuevo es el viejo de otro elemento del lote, todo pasa antes por un
 * nombre temporal. Devuelve lo que se hizo (para Deshacer), aunque falle a medias.
 */
export async function renameAll(items: Renamed[]): Promise<Renamed[]> {
  const sources = new Set(items.map((item) => item.from.toLowerCase()));
  const crossing = items.some((item) => item.to.toLowerCase() !== item.from.toLowerCase() && sources.has(item.to.toLowerCase()));

  const done: Renamed[] = [];
  const name = storage.lastSegment;
  const tag = Date.now().toString(36);
  const current = items.map((item) => item.from);

  if (crossing) {
    for (let i = 0; i < items.length; i++) {
      const temp = await renamePath(current[i], `~mi-rename-${tag}-${i}`);
      await storage.remapPath(current[i], temp);
      current[i] = temp;
    }
  }
  try {
    for (let i = 0; i < items.length; i++) {
      const to = await renamePath(current[i], name(items[i].to));
      await storage.remapPath(current[i], to);
      current[i] = to;
      done.push({ from: items[i].from, to });
    }
  } catch (err) {
    // Lo que se quedó con el nombre temporal vuelve a su nombre original.
    if (crossing) {
      for (let i = done.length; i < items.length; i++) {
        const back = await renamePath(current[i], name(items[i].from)).catch(() => null);
        if (back !== null) await storage.remapPath(current[i], back);
      }
    }
    // Lo ya renombrado viaja en el error para poder deshacerlo igualmente.
    if (done.length > 0 && typeof err === "object" && err !== null) Object.assign(err, { partial: done });
    throw err;
  }
  return done;
}
