/**
 * Zentrale Definition aller Benachrichtigungstypen.
 *
 * Jeder Typ wird in `Notification.type` gespeichert und bringt Standardwerte für Kategorie,
 * Art und Priorität mit. Neue Typen werden ausschließlich hier ergänzt und über
 * `notify()` (`./notify.ts`) verschickt.
 */

export const NOTIFICATION_CATEGORIES = [
  "proben",
  "termine",
  "gewerke",
  "produktion",
  "system",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** info = Hinweis, action = braucht eine Reaktion und bleibt offen, bis sie erledigt ist. */
export type NotificationKind = "info" | "action";
export type NotificationPriority = "normal" | "urgent";

/** Darstellung als Toast im offenen Tab. */
export type NotificationSeverity = "info" | "warning" | "success" | "error";

export const NOTIFICATION_TYPES = {
  REHEARSAL: "rehearsal",
  CALENDAR_EVENT: "calendar-event",
  REHEARSAL_UPDATE: "rehearsal-update",
  EVENT_CANCELLED: "event-cancelled",
  REHEARSAL_EMERGENCY: "rehearsal-emergency",
  REHEARSAL_ATTENDANCE: "rehearsal-attendance",
  REHEARSAL_TASK: "rehearsal-task",
  REHEARSAL_PROTOCOL: "rehearsal-protocol",
  EVENT_REMINDER: "event-reminder",
  DEPARTMENT_ASSIGNMENT: "department-assignment",
  DEPARTMENT_REQUEST: "department-request",
  DEPARTMENT_EVENT: "department-event",
  DEPARTMENT_TASK: "department-task",
  DEPARTMENT_HANDOVER: "department-handover",
  SCENE_REQUIREMENT: "scene-requirement",
  PLAN_DEADLINE: "plan-deadline",
  CASTING: "casting",
  PHOTO_CONSENT: "photo-consent",
  INVENTORY_DEFECT: "inventory-defect",
  INVENTORY_INSPECTION: "inventory-inspection",
  TEST: "test",
  TEST_EMERGENCY: "test-emergency",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/** @deprecated Alter Name, nur noch für bestehende Importe. */
export type RehearsalNotificationType = NotificationType;

export type NotificationTypeMeta = {
  category: NotificationCategory;
  kind: NotificationKind;
  priority: NotificationPriority;
  severity: NotificationSeverity;
};

export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  rehearsal: { category: "proben", kind: "info", priority: "normal", severity: "info" },
  "calendar-event": { category: "termine", kind: "info", priority: "normal", severity: "info" },
  "rehearsal-update": { category: "proben", kind: "info", priority: "normal", severity: "info" },
  "event-cancelled": { category: "proben", kind: "info", priority: "normal", severity: "warning" },
  "rehearsal-emergency": {
    category: "proben",
    kind: "action",
    priority: "urgent",
    severity: "error",
  },
  "rehearsal-attendance": {
    category: "proben",
    kind: "info",
    priority: "normal",
    severity: "warning",
  },
  "event-reminder": { category: "termine", kind: "info", priority: "normal", severity: "info" },
  "rehearsal-task": { category: "proben", kind: "action", priority: "normal", severity: "info" },
  "rehearsal-protocol": { category: "proben", kind: "info", priority: "normal", severity: "info" },
  "department-assignment": {
    category: "gewerke",
    kind: "info",
    priority: "normal",
    severity: "info",
  },
  "department-request": {
    category: "gewerke",
    kind: "action",
    priority: "normal",
    severity: "info",
  },
  "department-event": { category: "gewerke", kind: "info", priority: "normal", severity: "info" },
  "department-task": { category: "gewerke", kind: "info", priority: "normal", severity: "info" },
  "department-handover": {
    category: "gewerke",
    kind: "info",
    priority: "normal",
    severity: "info",
  },
  "scene-requirement": {
    category: "gewerke",
    kind: "action",
    priority: "normal",
    severity: "info",
  },
  "plan-deadline": {
    category: "produktion",
    kind: "info",
    priority: "normal",
    severity: "warning",
  },
  casting: { category: "produktion", kind: "info", priority: "normal", severity: "info" },
  "photo-consent": { category: "produktion", kind: "info", priority: "normal", severity: "info" },
  "inventory-defect": {
    category: "gewerke",
    kind: "info",
    priority: "normal",
    severity: "warning",
  },
  "inventory-inspection": {
    category: "gewerke",
    kind: "info",
    priority: "normal",
    severity: "warning",
  },
  test: { category: "system", kind: "info", priority: "normal", severity: "info" },
  "test-emergency": { category: "system", kind: "info", priority: "urgent", severity: "error" },
};

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && Object.hasOwn(NOTIFICATION_TYPE_META, value);
}

/** Kategorie eines Termins: Proben gehören zu „proben“, alles andere zu „termine“. */
export function categoryForEventKind(kind: string | null | undefined): NotificationCategory {
  return kind === "REHEARSAL" ? "proben" : "termine";
}

export function eventActionUrl(eventId: string) {
  return `/mitglieder/termine/${eventId}`;
}

export function departmentActionUrl(slug?: string | null) {
  return slug ? `/mitglieder/meine-gewerke/${slug}` : "/mitglieder/meine-gewerke";
}
