import { DEFAULT_TIME_ZONE } from "@/lib/format/date";

export const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});
export const time = (iso: string | null) => (iso ? TIME.format(new Date(iso)) : "–");
export const span = (start: string | null, end: string | null) =>
  start ? `${time(start)}${end ? `–${time(end)}` : ""}` : null;

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
