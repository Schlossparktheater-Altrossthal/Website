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
