import type { PageVisibilitySettings } from "@/lib/website-settings";

export type PublicPageKey = "about" | "mystery" | "schoolCat" | "timeline";

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

export function isPublicPageEnabled(key: PublicPageKey, visibility: PageVisibilitySettings): boolean {
  if (key === "about") return visibility.public.about;
  if (key === "mystery") return visibility.public.mystery;
  if (key === "schoolCat") return visibility.public.schoolCat;
  return visibility.public.timeline;
}
