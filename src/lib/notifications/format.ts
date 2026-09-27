import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

import type { InboxGroup } from "./inbox-shared";
import { NOTIFICATION_TYPES, type NotificationCategory } from "./types";

const DAY = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  timeZone: DEFAULT_TIME_ZONE,
});
const dateYearFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE });

/** Kurze Zeitangabe für Listen: „gerade eben“, „vor 5 Min.“, „gestern“, „12. Sept.“ */
export function formatNotificationTime(value: string | Date, now = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "gerade eben";
  if (diff < 60 * 60_000) return `vor ${Math.floor(diff / 60_000)} Min.`;

  const dayDiff = Math.round(
    (Date.parse(dayKeyFormatter.format(now)) - Date.parse(dayKeyFormatter.format(date))) / DAY,
  );
  if (dayDiff === 0) return `vor ${Math.floor(diff / (60 * 60_000))} Std.`;
  if (dayDiff === 1) return "gestern";
  if (dayDiff < 7) return `vor ${dayDiff} Tagen`;
  return date.getFullYear() === now.getFullYear()
    ? dateFormatter.format(date)
    : dateYearFormatter.format(date);
}

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  proben: "Proben",
  termine: "Termine",
  gewerke: "Gewerke",
  produktion: "Produktion",
  system: "System",
};

function afterDash(title: string) {
  const index = title.lastIndexOf(" – ");
  return index >= 0 ? title.slice(index + 3) : null;
}

/** Überschrift eines Bündels; Einzelstücke behalten ihren Titel. */
export function groupTitle(group: Pick<InboxGroup, "count" | "latest">) {
  const { latest, count } = group;
  if (count < 2) return latest.title;
  switch (latest.type) {
    case NOTIFICATION_TYPES.REHEARSAL_ATTENDANCE:
    case NOTIFICATION_TYPES.REHEARSAL_EMERGENCY: {
      const event = afterDash(latest.title);
      return event ? `${count} Absagen – ${event}` : `${count} Absagen`;
    }
    case NOTIFICATION_TYPES.DEPARTMENT_REQUEST: {
      const match = /^Anfrage für ([^:]+):/.exec(latest.title);
      return match ? `${count} Anfragen für ${match[1]}` : `${count} Anfragen`;
    }
    default:
      return latest.title;
  }
}

/** Erste Zeile des Textes, ohne Aufzählungszeichen. */
export function firstLine(body: string | null | undefined) {
  const line = body
    ?.split("\n")
    .map((entry) => entry.replace(/^[•\-–]\s*/, "").trim())
    .find(Boolean);
  return line ?? null;
}
