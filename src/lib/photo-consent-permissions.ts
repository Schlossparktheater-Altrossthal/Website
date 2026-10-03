import type { PhotoConsentLevel } from "@prisma/client";

/**
 * Was Fotografen für eine Person wissen müssen. Die Stufen entsprechen `PhotoConsentLevel`;
 * dazu kommen „missing“ (nicht abgegeben, nicht geprüft oder abgelehnt → nicht fotografieren)
 * und „unknown“ (Altbestand freigegeben, aber ohne erfasste Stufe).
 */
export type PhotoPermission = PhotoConsentLevel | "missing" | "unknown";

export type PhotoPermissionTone = "success" | "warning" | "info" | "destructive" | "muted";

export const PHOTO_PERMISSION_LABELS: Record<PhotoPermission, string> = {
  all: "Alles erlaubt",
  promoOnRequest: "Werbung nur nach Rückfrage",
  internal: "Nur intern",
  none: "Gar nicht",
  missing: "Nicht fotografieren",
  unknown: "Stufe unbekannt",
};

export const PHOTO_PERMISSION_HINTS: Record<PhotoPermission, string> = {
  all: "Intern, Programmheft, Flyer und Werbung",
  promoOnRequest: "Für Werbung vorher im Einzelfall fragen",
  internal: "Nur Aufnahmen für die Gruppe",
  none: "Keine Aufnahmen",
  missing: "Keine gültige Erlaubnis",
  unknown: "Beim Team nachfragen",
};

export const PHOTO_PERMISSION_TONES: Record<PhotoPermission, PhotoPermissionTone> = {
  all: "success",
  promoOnRequest: "warning",
  internal: "info",
  none: "destructive",
  missing: "destructive",
  unknown: "muted",
};

/** Restriktivste zuerst; „unbekannt“ am Ende (E5). */
export const PHOTO_PERMISSION_ORDER: readonly PhotoPermission[] = [
  "none",
  "missing",
  "internal",
  "promoOnRequest",
  "all",
  "unknown",
];
