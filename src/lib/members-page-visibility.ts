import { membersNavigation } from "@/config/members-navigation";

/** Seiten, die sich nicht ausblenden lassen, damit sich niemand aussperrt. */
export const LOCKED_MEMBER_PAGES: ReadonlySet<string> = new Set([
  "/mitglieder",
  "/mitglieder/pages/seitensteuerung",
]);

/** Recht, mit dem ausgeblendete Seiten weiterhin erreichbar bleiben. */
export const PAGE_VISIBILITY_BYPASS_PERMISSION = "PRIVATE.ADMIN.PAGES.MANAGE";

const navHrefsLongestFirst = membersNavigation
  .flatMap((group) => group.items)
  .map((item) => item.href)
  .sort((a, b) => b.length - a.length);

/**
 * Ordnet einen Pfad dem spezifischsten Navigationseintrag zu
 * (z. B. `/mitglieder/produktionen/stueck/123` → `/mitglieder/produktionen/stueck`).
 */
export function findMemberPageKey(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  return navHrefsLongestFirst.find((href) => path === href || path.startsWith(`${href}/`)) ?? null;
}

/** Ist die Seite hinter `pathname` in der Seitensteuerung ausgeblendet? */
export function isMemberPageHidden(pathname: string, visibility: Record<string, boolean>): boolean {
  const key = findMemberPageKey(pathname);
  if (!key || LOCKED_MEMBER_PAGES.has(key)) return false;
  return visibility[key] === false;
}
