import type { BackendError } from "./backendError.types";

export function isBackendError(value: unknown): value is BackendError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { key?: unknown }).key === "string"
  );
}

/** Najde v chybě (i vnořené) první klíč z `keys`. */
export function findKey(err: BackendError, keys: string[]): BackendError | null {
  if (keys.includes(err.key)) return err;
  for (const value of Object.values(err.args ?? {})) {
    if (isBackendError(value)) {
      const found = findKey(value, keys);
      if (found) return found;
    }
  }
  return null;
}
