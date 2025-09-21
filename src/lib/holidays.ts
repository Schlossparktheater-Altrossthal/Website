import { unstable_cache } from "next/cache";
import ical, { type VEvent } from "node-ical";
import { addDays, format } from "date-fns";

import type { HolidayRange } from "@/types/holidays";

export type { HolidayRange } from "@/types/holidays";

const DEFAULT_SAXONY_HOLIDAY_FEED =
  "https://www.schulferien.org/media/ical/deutschland/ferien_sachsen.ics";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function normaliseSummary(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function ensureDate(value: unknown) {
  if (!(value instanceof Date)) {
    return null;
  }
  const time = value.getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return value;
}

function resolveInclusiveEnd(start: Date, rawEnd: Date | null, isDateOnly: boolean) {
  if (!rawEnd) {
    return start;
  }

  if (isDateOnly || (rawEnd as Date & { dateOnly?: boolean }).dateOnly) {
    const adjusted = new Date(rawEnd.getTime() - DAY_IN_MS);
    if (adjusted.getTime() < start.getTime()) {
      return start;
    }
    return adjusted;
  }

  return rawEnd;
}

function toRange(event: VEvent): HolidayRange | null {
  const start = ensureDate(event.start);
  if (!start) {
    return null;
  }

  const end = resolveInclusiveEnd(start, ensureDate(event.end), event.datetype === "date");
  const summary = normaliseSummary(event.summary);

  const startDate = format(start, "yyyy-MM-dd");
  const endDate = format(end, "yyyy-MM-dd");

  const uid = normaliseSummary(event.uid);
  const id = uid || `${startDate}-${endDate}-${summary || "ferien"}`;

  return {
    id,
    title: summary || "Ferien",
    startDate,
    endDate,
  };
}

function parseHolidayRanges(body: string) {
  const parsed = ical.sync.parseICS(body);
  const ranges: HolidayRange[] = [];

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== "VEVENT") {
      continue;
    }
    const range = toRange(component);
    if (range) {
      ranges.push(range);
    }
  }

  ranges.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return ranges;
}

async function fetchHolidayFeed() {
  const source = process.env.SAXONY_HOLIDAYS_ICS_URL || DEFAULT_SAXONY_HOLIDAY_FEED;

  if (!source) {
    return [] as HolidayRange[];
  }

  try {
    const response = await fetch(source, {
      headers: {
        Accept: "text/calendar, text/plain;q=0.9,*/*;q=0.1",
        "User-Agent":
          "Theaterverein Kalenderbot/1.0 (+https://devtheater.beegreenx.de)",
        Referer: "https://devtheater.beegreenx.de/mitglieder/sperrliste",
      },
      next: { revalidate: 60 * 60 * 12 },
    });

    if (!response.ok) {
      throw new Error(`Unexpected response: ${response.status}`);
    }

    const body = await response.text();

    if (!body.trim()) {
      throw new Error("Ferien-Kalender lieferte keine Daten");
    }

    return parseHolidayRanges(body);
  } catch (error) {
    console.error("[holidays] feed fetch failed", error);
    return [] as HolidayRange[];
  }
}

export const getSaxonySchoolHolidayRanges = unstable_cache(
  async () => {
    const ranges = await fetchHolidayFeed();

    const thresholdStart = format(addDays(new Date(), -365), "yyyy-MM-dd");
    const thresholdEnd = format(addDays(new Date(), 365 * 3), "yyyy-MM-dd");

    return ranges.filter(
      (range) => range.endDate >= thresholdStart && range.startDate <= thresholdEnd,
    );
  },
  ["saxony-school-holidays"],
  { revalidate: 60 * 60 * 12 },
);
