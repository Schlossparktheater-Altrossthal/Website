import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

export function formatDateTime(value: string | Date) {
  return DATE_TIME.format(typeof value === "string" ? new Date(value) : value);
}

/** „von Name, 13.10.2026, 09:12“ – Urheber und Zeitpunkt werden immer angezeigt. */
export function byline(name: string | null, at: string | Date) {
  return `${name ?? "Unbekannt"}, ${formatDateTime(at)}`;
}
