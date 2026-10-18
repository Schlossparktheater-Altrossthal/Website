const PRODUCTIONS_HOME = "/mitglieder/produktionen";

/** IDs aus Prisma (cuid) oder UUIDs – solche Segmente gehören zu einem bestimmten Datensatz. */
const RECORD_ID_SEGMENT =
  /^(c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Ziel nach dem Wechsel der Produktion: dieselbe Seite der anderen Produktion.
 * Die ID der alten Produktion wird ersetzt; Datensätze der alten Produktion (Probe, Szene …)
 * gibt es in der neuen nicht, deshalb geht es dort auf die übergeordnete Seite.
 * Außerhalb des Mitgliederbereichs geht es auf die Produktionsübersicht.
 */
export function resolveProductionSwitchTarget(
  pathname: string | null | undefined,
  fromId: string | null | undefined,
  toId: string,
): string {
  if (!pathname || !pathname.startsWith("/mitglieder")) return PRODUCTIONS_HOME;
  const segments = pathname.split("/").filter(Boolean);
  const replaced = segments.map((segment) => (fromId && segment === fromId ? toId : segment));
  const firstForeignId = replaced.findIndex(
    (segment) => segment !== toId && RECORD_ID_SEGMENT.test(segment),
  );
  const kept = firstForeignId === -1 ? replaced : replaced.slice(0, firstForeignId);
  return kept.length > 0 ? `/${kept.join("/")}` : PRODUCTIONS_HOME;
}
