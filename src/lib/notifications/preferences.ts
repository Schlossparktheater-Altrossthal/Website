import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

import type { NotificationCategory, NotificationKind, NotificationPriority } from "./types";

export type PushPreference = { category: string; push: boolean };

export const CATEGORY_DESCRIPTIONS: Record<NotificationCategory, string> = {
  proben: "Neue und geänderte Proben, Absagen",
  termine: "Treffen, Arbeitseinsätze und andere Termine",
  gewerke: "Anfragen, Aufgaben und Termine deiner Gewerke",
  produktion: "Besetzung und Fotoerlaubnisse",
  system: "Hinweise der Website",
};

/**
 * Soll ein Eintrag per Push kommen? Dringendes und Aufgaben immer; übrige Hinweise nur, wenn
 * der Bereich eingeschaltet ist (Standard: aus).
 */
export function shouldPush(
  notification: {
    category: NotificationCategory;
    kind: NotificationKind;
    priority: NotificationPriority;
  },
  preference: PushPreference | undefined,
) {
  if (notification.priority === "urgent" || notification.kind === "action") return true;
  return preference?.push ?? false;
}

export type QuietHours = { start: number; end: number };

const minuteFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Liegt `now` (Ortszeit Berlin) in der Ruhezeit? Ende vor Beginn heißt über Mitternacht. */
export function isInQuietHours(quiet: QuietHours | null | undefined, now = new Date()) {
  if (!quiet || quiet.start === quiet.end) return false;
  const [hours, minutes] = minuteFormatter.format(now).split(":").map(Number);
  const current = hours * 60 + minutes;
  return quiet.start < quiet.end
    ? current >= quiet.start && current < quiet.end
    : current >= quiet.start || current < quiet.end;
}

export function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function timeToMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Vorlaufzeiten für Termin-Erinnerungen. `never` schaltet die Erinnerung ab, `1d` ist der
 * Standard, wenn ein Nutzer nichts gespeichert hat.
 */
export const EVENT_REMINDER_LEAD_CODES = [
  "never",
  "1h",
  "2h",
  "12h",
  "1d",
  "2d",
  "3d",
  "7d",
] as const;

export type EventReminderLead = (typeof EVENT_REMINDER_LEAD_CODES)[number];

/** Standard-Vorlaufzeit, solange in `NotificationSettings.reminderLead` nichts gespeichert ist. */
export const DEFAULT_REMINDER_LEAD: EventReminderLead = "1d";

const EVENT_REMINDER_LEAD_MINUTES: Record<EventReminderLead, number | null> = {
  never: null,
  "1h": 60,
  "2h": 120,
  "12h": 720,
  "1d": 1440,
  "2d": 2880,
  "3d": 4320,
  "7d": 10080,
};

const EVENT_REMINDER_LEAD_LABELS: Record<EventReminderLead, string> = {
  never: "Nie",
  "1h": "1 Stunde vorher",
  "2h": "2 Stunden vorher",
  "12h": "12 Stunden vorher",
  "1d": "1 Tag vorher",
  "2d": "2 Tage vorher",
  "3d": "3 Tage vorher",
  "7d": "7 Tage vorher",
};

/** Auswahlliste für die Oberfläche, in fester Reihenfolge. */
export const EVENT_REMINDER_LEAD_OPTIONS = EVENT_REMINDER_LEAD_CODES.map((value) => ({
  value,
  label: EVENT_REMINDER_LEAD_LABELS[value],
}));

export function isEventReminderLead(value: unknown): value is EventReminderLead {
  return typeof value === "string" && Object.hasOwn(EVENT_REMINDER_LEAD_MINUTES, value);
}

/** Minuten Vorlauf für einen Code; `null` bedeutet „nie“. */
export function reminderLeadMinutes(lead: EventReminderLead): number | null {
  return EVENT_REMINDER_LEAD_MINUTES[lead];
}

/** Gültigen Code auflösen: gespeicherter Wert, sonst der Standard. */
export function resolveReminderLead(stored: string | null | undefined): EventReminderLead {
  return isEventReminderLead(stored) ? stored : DEFAULT_REMINDER_LEAD;
}
