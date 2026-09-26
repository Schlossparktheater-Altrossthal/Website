/** Minimaler iCalendar-Erzeuger (RFC 5545) für den persönlichen Kalender-Feed. */

export type IcsTime =
  /** Zeitpunkt in UTC. */
  | { kind: "dateTime"; value: Date }
  /** Kalendertag (yyyy-MM-dd) ohne Uhrzeit. */
  | { kind: "date"; value: string };

export type IcsEvent = {
  uid: string;
  summary: string;
  start: IcsTime;
  /** Bei Tagen exklusiv (Folgetag), wie vom Standard verlangt. */
  end: IcsTime;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  cancelled?: boolean;
  /** Blockiert die Zeit nicht (z. B. eigene Sperren). */
  transparent?: boolean;
  lastModified?: Date | null;
};

export type IcsCalendar = {
  name: string;
  description?: string;
  events: IcsEvent[];
  now?: Date;
};

export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Zeilen länger als 75 Oktette umbrechen, ohne UTF-8-Zeichen zu zerteilen. */
export function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Folgezeilen beginnen mit einem Leerzeichen, das mitzählt.
    const limit = parts.length ? 74 : 75;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function formatUtc(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function formatTime(name: string, time: IcsTime) {
  return time.kind === "date"
    ? `${name};VALUE=DATE:${time.value.replace(/-/g, "")}`
    : `${name}:${formatUtc(time.value)}`;
}

function eventLines(event: IcsEvent, now: Date) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtc(now)}`,
    formatTime("DTSTART", event.start),
    formatTime("DTEND", event.end),
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  if (event.lastModified) {
    lines.push(`LAST-MODIFIED:${formatUtc(event.lastModified)}`);
    // Steigt mit jeder Änderung, damit Kalender Verschiebungen übernehmen.
    lines.push(`SEQUENCE:${Math.floor(event.lastModified.getTime() / 1000)}`);
  }
  lines.push(`STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`);
  lines.push(`TRANSP:${event.transparent ? "TRANSPARENT" : "OPAQUE"}`);
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcsCalendar({ name, description, events, now = new Date() }: IcsCalendar) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mitgliederbereich//Kalender-Feed//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    // Hinweis an die Kalender-Apps, wie oft sie neu laden sollen (Google ignoriert ihn).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  if (description) lines.push(`X-WR-CALDESC:${escapeIcsText(description)}`);
  for (const event of events) lines.push(...eventLines(event, now));
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
