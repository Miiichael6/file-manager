import { findKey, isBackendError, type BackendError } from "../domain/backendError";
import type { ItemFailure } from "../domain/fileops";
import { errorText, isMessageKey, t, type Params } from "../i18n/index";

/* ------------------------------ chyby backendu ------------------------------ */

/**
 * Jediné místo, kde se chyba z backendu mění na text — v jazyce UI v okamžiku
 * chyby. Neznámý klíč (novější backend) projde aspoň s parametry.
 */
export function localizeError(err: unknown): string {
  if (!isBackendError(err)) return errorText(err);

  const params: Params = {};
  for (const [name, value] of Object.entries(err.args ?? {})) {
    params[name] = typeof value === "object" ? localizeError(value) : value;
  }

  if (isMessageKey(err.key)) return t(err.key, params);
  return [err.key, ...Object.values(params)].join(" ");
}

/**
 * Chyba z backendu: `message` je přeložený text (volající dál dělají jen
 * `errorText(err)`), `backend` původní `{ key, args }`.
 */
export class BackendFailure extends Error {
  constructor(readonly backend: BackendError) {
    super(localizeError(backend));
  }
}

function backendOf(err: unknown): BackendError | null {
  if (err instanceof BackendFailure) return err.backend;
  return isBackendError(err) ? err : null;
}

/** Technický detail neznámé chyby (kód a text Windows) — patří do rozbalení. */
export function errorDetail(err: unknown): string | undefined {
  const backend = backendOf(err);
  const unknown = backend && findKey(backend, ["error.unknown"]);
  const detail = unknown?.args?.detail;
  return typeof detail === "string" && detail.trim() !== "" ? detail : undefined;
}

/** Odepřený přístup přímo u položky (ne vnořený důvod) — pomohlo by „Pokračovat jako správce". */
export function needsAdmin(err: unknown): boolean {
  const backend = backendOf(err);
  if (!backend) return false;
  const direct = backend.key === "error.atPath" ? backend.args?.reason : backend;
  return isBackendError(direct) && direct.key === "error.permissionDenied";
}

/** Uživatel operaci zrušil (odmítnutá výzva UAC). */
export function isCancelled(err: unknown): boolean {
  const backend = backendOf(err);
  return backend !== null && findKey(backend, ["error.cancelled"]) !== null;
}

/** Text selhání jedné položky („C:\x.txt: nemáte oprávnění"). */
export function failureText(failure: ItemFailure): string {
  return t("error.atPath", { path: failure.path, reason: localizeError(failure.error) });
}

/** Detail neznámé chyby u položky. */
export function failureDetail(failure: ItemFailure): string | undefined {
  return errorDetail(failure.error);
}
