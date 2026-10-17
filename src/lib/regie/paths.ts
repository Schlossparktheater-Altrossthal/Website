/** Einstieg der Regie-Ansicht (docs/Plan/regie-plan.md). */
export const DIRECTION_HOME_PATH = "/mitglieder/regie";

/**
 * Pfade, die in der Regie-Ansicht (`User.directionView`) erreichbar bleiben.
 * Alles andere unter /mitglieder leitet auf das Dashboard um.
 */
const DIRECTION_VIEW_ALLOWED_PREFIXES = [
  DIRECTION_HOME_PATH,
  "/mitglieder/profil",
  "/mitglieder/benachrichtigungen",
] as const;

export function isDirectionViewPathAllowed(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return DIRECTION_VIEW_ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
