import { invoke as tauriInvoke, type InvokeArgs } from "@tauri-apps/api/core";

import { BackendFailure } from "../application/errors";
import { isBackendError } from "../domain/backendError";

/**
 * invoke() se srozumitelnou chybou: místo objektu `{ key, args }` odmítne
 * BackendFailure s přeloženým textem. Používají ho jen adaptéry.
 */
export async function invoke<T>(command: string, args?: InvokeArgs): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (err: unknown) {
    throw isBackendError(err) ? new BackendFailure(err) : err;
  }
}
