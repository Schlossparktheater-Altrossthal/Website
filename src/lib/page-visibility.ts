import type { PageVisibilitySettings } from "@/lib/website-settings";

export function isMembersPathEnabled(pathname: string, visibility: PageVisibilitySettings): boolean {
  const ds = visibility.categories.dateisystem;
  if (!ds.enabled) {
    return !pathname.startsWith("/mitglieder/archiv") && !pathname.startsWith("/mitglieder/bilder") && !pathname.startsWith("/mitglieder/chronik") && !pathname.startsWith("/mitglieder/daten");
  }

  if (pathname.startsWith("/mitglieder/archiv")) return ds.archive;
  if (pathname.startsWith("/mitglieder/bilder")) return ds.images;
  if (pathname.startsWith("/mitglieder/chronik")) return ds.timeline;
  if (pathname.startsWith("/mitglieder/daten")) return ds.data;

  return true;
}
