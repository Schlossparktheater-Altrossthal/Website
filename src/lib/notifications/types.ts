/**
 * Zentrale Definition der Benachrichtigungstypen für Proben-Ereignisse.
 *
 * Diese Typen werden in `Notification.type` gespeichert und an mehreren Stellen
 * (Erstellung, Antwort-Handling, Darstellung) verwendet. Änderungen erfolgen
 * ausschließlich hier.
 */

export const NOTIFICATION_TYPES = {
  REHEARSAL_UPDATE: "rehearsal-update",
  REHEARSAL_EMERGENCY: "rehearsal-emergency",
  REHEARSAL_ATTENDANCE: "rehearsal-attendance",
} as const;

export type RehearsalNotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
