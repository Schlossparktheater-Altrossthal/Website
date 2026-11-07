import { DEFAULT_TIME_ZONE } from "@/lib/format/date";

/** Datums-Helfer der Regie-Ansichten (ohne Server-Abhängigkeiten, auch im Client nutzbar). */
const DATE = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE });

export const dayKeyOf = (date: Date) => DAY_KEY.format(date);
export const formatDay = (date: Date) => DATE.format(date).replace(/\.,/, ",");
export const formatTime = (date: Date) => TIME.format(date);
