/**
 * Einheitliches Ergebnis für Server Actions. Neue Actions sollten diesen Typ verwenden
 * statt eigener `…Result`-Typen mit `success`/`error`-Varianten.
 */
export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T) {
  return { ok: true, data } as ActionResult<T>;
}

export function actionError(
  error: string,
  fieldErrors?: Record<string, string>,
): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Wandelt einen Zod-Fehler in ein Ergebnis mit Feldmeldungen. */
export function actionValidationError(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return actionError(error.issues[0]?.message ?? "Ungültige Eingaben.", fieldErrors);
}
