import { unstable_cache } from "next/cache";
import ical, { type VEvent } from "node-ical";
import { addDays, format, isValid, parseISO } from "date-fns";

import { SAXONY_SCHOOL_HOLIDAYS } from "@/data/saxony-school-holidays";

import type { HolidayRange } from "@/types/holidays";

export type { HolidayRange } from "@/types/holidays";

const DEFAULT_SAXONY_HOLIDAY_FEED =
  "https://www.schulferien.org/media/ical/deutschland/ferien_sachsen.ics";
const FALLBACK_SAXONY_HOLIDAY_FEED = "https://ferien-api.de/api/v1/holidays/SN";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function isTruthyFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalised = value.trim().toLowerCase();
  return normalised === "1" || normalised === "true" || normalised === "yes" || normalised === "on";
}

function isOutboundHttpDisabled() {
  if (typeof fetch !== "function") {
    return true;
  }

  return isTruthyFlag(process.env.OUTBOUND_HTTP_DISABLED);
}

function getStaticHolidayRanges() {
  return SAXONY_SCHOOL_HOLIDAYS.map((range) => ({ ...range }));
}

function normaliseSummary(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function normaliseFallbackTitle(value: unknown) {
  const summary = normaliseSummary(value);
  if (!summary) {
    return "Ferien";
  }

  return summary.replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase("de-DE"));
}

function normaliseIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = parseISO(trimmed);
  if (!isValid(parsed)) {
    return null;
  }

  return format(parsed, "yyyy-MM-dd");
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

type FerienApiHoliday = {
  start?: string;
  end?: string;
  name?: string;
  slug?: string;
};

function parseFallbackHolidayRanges(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [] as HolidayRange[];
  }

  const ranges: HolidayRange[] = [];

  for (const entry of payload as FerienApiHoliday[]) {
    if (!entry) {
      continue;
    }

    const startDate = normaliseIsoDate(entry.start);
    const endDate = normaliseIsoDate(entry.end);

    if (!startDate || !endDate) {
      continue;
    }

    const title = normaliseFallbackTitle(entry.name);
    const slug = normaliseSummary(entry.slug);

    ranges.push({
      id: slug ? `ferien-api:${slug}` : `${startDate}-${endDate}-${title}`,
      title,
      startDate,
      endDate,
    });
  }

  ranges.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return ranges;
}

async function fetchFallbackHolidayFeed() {
  try {
    const response = await fetch(FALLBACK_SAXONY_HOLIDAY_FEED, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Theaterverein Kalenderbot/1.0 (+https://devtheater.beegreenx.de)",
        Referer: "https://devtheater.beegreenx.de/mitglieder/sperrliste",
      },
      next: { revalidate: 60 * 60 * 12 },
    });

    if (!response.ok) {
      throw new Error(`Unexpected response: ${response.status}`);
    }

    const payload = await response.json();
    return parseFallbackHolidayRanges(payload);
  } catch (error) {
    console.error("[holidays] fallback feed fetch failed", error);
    return [] as HolidayRange[];
  }
}

async function fetchIcsHolidayFeed() {
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

async function fetchHolidayFeed() {
  if (isOutboundHttpDisabled()) {
    return getStaticHolidayRanges();
  }

  const rangesFromIcs = await fetchIcsHolidayFeed();
  if (rangesFromIcs.length > 0) {
    return rangesFromIcs;
  }

  const fallbackRanges = await fetchFallbackHolidayFeed();
  if (fallbackRanges.length > 0) {
    return fallbackRanges;
  }

  return getStaticHolidayRanges();
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
