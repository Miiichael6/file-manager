/** Chyba z Rustu (AppError): klíč do slovníku a parametry, i vnořené chyby. */
export type BackendError = { key: string; args?: Record<string, string | number | BackendError> };
