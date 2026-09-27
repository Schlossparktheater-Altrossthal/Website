import type { HolidayRange } from "@/types/holidays";

/** Datum als yyyy-MM-dd ohne Zeitzonen-Einfluss (UTC-Rechnung). */
function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Ostersonntag nach der Gaußschen Osterformel (gregorianisch, anonymer Algorithmus). */
export function getEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** Buß- und Bettag: der Mittwoch vor dem 23. November. */
function getRepentanceDay(year: number) {
  const nov23 = utc(year, 11, 23);
  const back = (nov23.getUTCDay() - 3 + 7) % 7 || 7;
  return addDays(nov23, -back);
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Gesetzliche Feiertage in Sachsen für ein Jahr, mit deutschen Namen. */
export function getSaxonyPublicHolidays(year: number): HolidayRange[] {
  const easter = getEasterSunday(year);
  const days: [Date, string][] = [
    [utc(year, 1, 1), "Neujahrstag"],
    [addDays(easter, -2), "Karfreitag"],
    [addDays(easter, 1), "Ostermontag"],
    [utc(year, 5, 1), "Tag der Arbeit"],
    [addDays(easter, 39), "Christi Himmelfahrt"],
    [addDays(easter, 50), "Pfingstmontag"],
    [addDays(easter, 60), "Fronleichnam"],
    [utc(year, 10, 3), "Tag der Deutschen Einheit"],
    [utc(year, 10, 31), "Reformationstag"],
    [getRepentanceDay(year), "Buß- und Bettag"],
    [utc(year, 12, 25), "1. Weihnachtstag"],
    [utc(year, 12, 26), "2. Weihnachtstag"],
  ];
  return days
    .map(([date, title]) => {
      const key = toKey(date);
      return {
        id: `public-holiday:${key}-${slugify(title)}`,
        title,
        startDate: key,
        endDate: key,
        category: "publicHoliday" as const,
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Feiertage mehrerer Jahre (inklusive). */
export function getSaxonyPublicHolidaysBetween(fromYear: number, toYear: number) {
  const ranges: HolidayRange[] = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    ranges.push(...getSaxonyPublicHolidays(year));
  }
  return ranges;
}

/** Deutscher Name eines sächsischen Feiertags an diesem Tag (yyyy-MM-dd), sonst null. */
export function getSaxonyPublicHolidayName(dayKey: string) {
  const year = Number(dayKey.slice(0, 4));
  if (!Number.isInteger(year)) return null;
  return getSaxonyPublicHolidays(year).find((entry) => entry.startDate === dayKey)?.title ?? null;
}
