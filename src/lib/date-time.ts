export const DEFAULT_TIME_ZONE = "Europe/Berlin" as const;

function ensureValidDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
}

export function parseDateTimeInTimeZone(
  date: string,
  time: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const [yearStr, monthStr, dayStr] = date.split("-");
  const [hourStr, minuteStr] = time.split(":");
  const year = Number.parseInt(yearStr ?? "", 10);
  const month = Number.parseInt(monthStr ?? "", 10);
  const day = Number.parseInt(dayStr ?? "", 10);
  const hour = Number.parseInt(hourStr ?? "", 10);
  const minute = Number.parseInt(minuteStr ?? "", 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    throw new Error("Invalid date parts");
  }

  // Wandzeit als UTC annehmen und um den Versatz der Zielzone korrigieren. Zweimal, damit
  // Tage mit Zeitumstellung stimmen. Unabhängig von der Zeitzone des Servers.
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(wallClock);
  ensureValidDate(result);
  for (let pass = 0; pass < 2; pass += 1) {
    result = new Date(wallClock - getTimeZoneOffsetMs(result, timeZone));
  }
  ensureValidDate(result);
  return result;
}

/** Versatz der Zeitzone gegenüber UTC zum angegebenen Zeitpunkt (z. B. +2 h im Sommer). */
function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function formatParts(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Map<string, string> {
  const date = new Date(iso);
  ensureValidDate(date);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, ...options });
  const parts = formatter.formatToParts(date);
  const map = new Map<string, string>();
  for (const part of parts) {
    map.set(part.type, part.value);
  }
  return map;
}

export function formatIsoDateInTimeZone(iso: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  const parts = formatParts(iso, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const year = parts.get("year") ?? "0000";
  const month = parts.get("month") ?? "01";
  const day = parts.get("day") ?? "01";
  return `${year}-${month}-${day}`;
}

export function formatIsoTimeInTimeZone(iso: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  const parts = formatParts(iso, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const hour = parts.get("hour") ?? "00";
  const minute = parts.get("minute") ?? "00";
  return `${hour}:${minute}`;
}
