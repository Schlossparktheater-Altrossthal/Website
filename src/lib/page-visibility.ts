import type { PageVisibilitySettings } from "@/lib/website-settings";

export type PublicPageKey = "about" | "mystery" | "schoolCat" | "timeline";

export function isMembersPathEnabled(pathname: string, visibility: PageVisibilitySettings): boolean {
  const dateisystemSettings = visibility.categories.dateisystem;
  if (!dateisystemSettings.enabled) {
    return !pathname.startsWith("/mitglieder/archiv") && !pathname.startsWith("/mitglieder/bilder") && !pathname.startsWith("/mitglieder/chronik") && !pathname.startsWith("/mitglieder/daten");
  }

  if (pathname.startsWith("/mitglieder/archiv")) return dateisystemSettings.archive;
  if (pathname.startsWith("/mitglieder/bilder")) return dateisystemSettings.images;
  if (pathname.startsWith("/mitglieder/chronik")) return dateisystemSettings.timeline;
  if (pathname.startsWith("/mitglieder/daten")) return dateisystemSettings.data;
  return true;
}

export function isPublicPageEnabled(key: PublicPageKey, visibility: PageVisibilitySettings): boolean {
  if (key === "about") return visibility.public.about;
  if (key === "mystery") return visibility.public.mystery;
  if (key === "schoolCat") return visibility.public.schoolCat;
  return visibility.public.timeline;
}
