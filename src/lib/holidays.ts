import { unstable_cache } from "next/cache";
import ical, { type VEvent } from "node-ical";
import { addDays, format, isValid, parseISO } from "date-fns";

import { SAXONY_SCHOOL_HOLIDAYS } from "@/data/saxony-school-holidays";
import {
  applyHolidaySourceStatus,
  getDefaultHolidaySourceUrl,
  readSperrlisteSettings,
  resolveSperrlisteSettings,
  type HolidaySourceStatus,
  type ResolvedSperrlisteSettings,
} from "@/lib/sperrliste-settings";

import type { HolidayRange } from "@/types/holidays";

export type { HolidayRange } from "@/types/holidays";
const FALLBACK_SAXONY_HOLIDAY_FEED = "https://ferien-api.de/api/v1/holidays/SN";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOLIDAY_FETCH_TIMEOUT_MS = 10_000;
const HOLIDAY_FETCH_MAX_BYTES = 1_000_000; // 1 MB
const HOLIDAY_PROTOCOL_ALLOWLIST = new Set(["https:"]);

const STATIC_ALLOWED_HOSTS = [
  "www.feiertage-deutschland.de",
  "ferien-api.de",
];

function collectAllowedHosts() {
  const hosts = new Set<string>();
  for (const host of STATIC_ALLOWED_HOSTS) {
    hosts.add(host);
  }

  const envHosts = process.env.SPERRELISTE_HOLIDAY_HOST_ALLOWLIST;
  if (envHosts) {
    for (const entry of envHosts.split(",")) {
      const trimmed = entry.trim().toLowerCase();
      if (trimmed) {
        hosts.add(trimmed);
      }
    }
  }

  for (const candidate of [getDefaultHolidaySourceUrl(), FALLBACK_SAXONY_HOLIDAY_FEED]) {
    try {
      const hostname = new URL(candidate).hostname.toLowerCase();
      if (hostname) {
        hosts.add(hostname);
      }
    } catch {
      // ignore invalid URLs from configuration
    }
  }

  return hosts;
}

const HOLIDAY_HOST_ALLOWLIST = collectAllowedHosts();

class HolidaySourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "HolidaySourceError";
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function normaliseHostname(url: string) {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    if (!HOLIDAY_PROTOCOL_ALLOWLIST.has(protocol)) {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isHolidaySourceUrlAllowed(url: string) {
  const hostname = normaliseHostname(url);
  if (!hostname) {
    return false;
  }
  return HOLIDAY_HOST_ALLOWLIST.has(hostname);
}

function ensureHolidaySourceUrlAllowed(url: string) {
  if (isHolidaySourceUrlAllowed(url)) {
    return;
  }
  console.warn("[holidays] blocked holiday source", { url });
  throw new HolidaySourceError("Ferienquelle ist nicht erlaubt.");
}

function createAbortSignal(timeoutMs: number) {
  const timeoutFactory = (AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }).timeout;
  if (typeof timeoutFactory === "function") {
    return timeoutFactory(timeoutMs);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  if (typeof timeout.unref === "function") {
    timeout.unref();
  }
  return controller.signal;
}

async function readResponseBody(response: Response) {
  const headerLength = response.headers.get("content-length");
  if (headerLength) {
    const numeric = Number.parseInt(headerLength, 10);
    if (!Number.isNaN(numeric) && numeric > HOLIDAY_FETCH_MAX_BYTES) {
      console.warn("[holidays] blocked holiday source due to declared size", {
        url: response.url,
        contentLength: numeric,
      });
      throw new HolidaySourceError("Ferienquelle lieferte zu viele Daten.");
    }
  }

  const stream = response.body?.getReader();
  if (!stream) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > HOLIDAY_FETCH_MAX_BYTES) {
      console.warn("[holidays] blocked holiday source due to payload size", {
        url: response.url,
        contentLength: arrayBuffer.byteLength,
      });
      throw new HolidaySourceError("Ferienquelle lieferte zu viele Daten.");
    }
    return new Uint8Array(arrayBuffer);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await stream.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > HOLIDAY_FETCH_MAX_BYTES) {
      await stream.cancel();
      console.warn("[holidays] blocked holiday source due to streaming payload size", {
        url: response.url,
        contentLength: total,
      });
      throw new HolidaySourceError("Ferienquelle lieferte zu viele Daten.");
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function decodeBodyBytes(bytes: Uint8Array) {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes);
}

type HolidayFetchStatus = {
  status: HolidaySourceStatus;
  message: string | null;
  checkedAt: Date;
};

export type HolidayFetchResult = {
  ranges: HolidayRange[];
  status: HolidayFetchStatus;
};

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

function formatRangeCount(count: number) {
  return count === 1 ? "1 Zeitraum" : `${count} Zeiträume`;
}

function filterRelevantRanges(ranges: HolidayRange[]) {
  const thresholdStart = format(addDays(new Date(), -365), "yyyy-MM-dd");
  const thresholdEnd = format(addDays(new Date(), 365 * 3), "yyyy-MM-dd");

  return ranges.filter(
    (range) => range.endDate >= thresholdStart && range.startDate <= thresholdEnd,
  );
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

async function fetchHolidayUrl(url: string) {
  ensureHolidaySourceUrlAllowed(url);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "text/calendar, application/json;q=0.9,*/*;q=0.1",
        "User-Agent": "Theaterverein Kalenderbot/1.0 (+https://devtheater.beegreenx.de)",
        Referer: "https://devtheater.beegreenx.de/mitglieder/sperrliste",
      },
      signal: createAbortSignal(HOLIDAY_FETCH_TIMEOUT_MS),
      next: { revalidate: 60 * 60 * 12 },
    });
  } catch (error) {
    console.error("[holidays] holiday source fetch failed", { url, error });
    throw new HolidaySourceError("Ferienquelle konnte nicht geladen werden.", { cause: error });
  }

  if (!response.ok) {
    console.warn("[holidays] holiday source returned unexpected status", {
      url,
      status: response.status,
    });
    throw new HolidaySourceError("Ferienquelle konnte nicht geladen werden.");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const isJson = contentType.includes("json") || url.toLowerCase().endsWith(".json");
  const bodyBytes = await readResponseBody(response);
  const bodyText = decodeBodyBytes(bodyBytes);

  if (isJson) {
    try {
      const payload = JSON.parse(bodyText);
      const ranges = parseFallbackHolidayRanges(payload);
      if (ranges.length === 0) {
        throw new HolidaySourceError("Ferienquelle lieferte keine verwertbaren Daten.");
      }
      return ranges;
    } catch (error) {
      if (error instanceof HolidaySourceError) {
        throw error;
      }
      console.warn("[holidays] holiday source returned invalid JSON", { url, error });
      throw new HolidaySourceError("Ferienquelle lieferte kein gültiges JSON.");
    }
  }

  if (!bodyText.trim()) {
    throw new HolidaySourceError("Ferienquelle lieferte keine Daten.");
  }

  const ranges = parseHolidayRanges(bodyText);
  if (ranges.length === 0) {
    throw new HolidaySourceError("Ferienquelle lieferte keine Termine.");
  }
  return ranges;
}

function createStaticFallbackStatus(message: string, checkedAt: Date): HolidayFetchStatus {
  return {
    status: "error",
    message,
    checkedAt,
  };
}

export async function fetchHolidayRangesForSettings(
  settings: ResolvedSperrlisteSettings,
): Promise<HolidayFetchResult> {
  const checkedAt = new Date();

  if (settings.holidaySource.mode === "disabled") {
    const ranges = filterRelevantRanges(getStaticHolidayRanges());
    return {
      ranges,
      status: {
        status: "disabled",
        message: "Ferienquelle ist deaktiviert. Es werden nur statische Termine verwendet.",
        checkedAt,
      },
    };
  }

  if (isOutboundHttpDisabled()) {
    const ranges = filterRelevantRanges(getStaticHolidayRanges());
    return {
      ranges,
      status: createStaticFallbackStatus(
        "Externe Abrufe sind deaktiviert (OUTBOUND_HTTP_DISABLED). Es wird die statische Ferienliste genutzt.",
        checkedAt,
      ),
    };
  }

  const primaryUrl =
    settings.holidaySource.mode === "custom"
      ? settings.holidaySource.url
      : settings.holidaySource.effectiveUrl ?? getDefaultHolidaySourceUrl();

  let primaryError: Error | null = null;

  if (primaryUrl) {
    try {
      const primaryRanges = await fetchHolidayUrl(primaryUrl);
      const filtered = filterRelevantRanges(primaryRanges);
      return {
        ranges: filtered,
        status: {
          status: "ok",
          message: `Quelle ${primaryUrl} lieferte ${formatRangeCount(filtered.length)}.`,
          checkedAt,
        },
      };
    } catch (error) {
      primaryError = error instanceof Error ? error : new Error("Ferienquelle konnte nicht geladen werden.");
      console.error("[holidays] primary feed fetch failed", primaryError);
    }
  } else {
    primaryError = new Error("Keine Ferienquelle konfiguriert.");
  }

  if (settings.holidaySource.mode === "default") {
    const fallbackRanges = await fetchFallbackHolidayFeed();
    if (fallbackRanges.length > 0) {
      const filtered = filterRelevantRanges(fallbackRanges);
      return {
        ranges: filtered,
        status: {
          status: primaryError ? "error" : "ok",
          message: primaryError
            ? `Primärer Feed (${primaryUrl ?? getDefaultHolidaySourceUrl()}) schlug fehl: ${primaryError.message}. Fallback (${FALLBACK_SAXONY_HOLIDAY_FEED}) lieferte ${formatRangeCount(filtered.length)}.`
            : `Fallback (${FALLBACK_SAXONY_HOLIDAY_FEED}) lieferte ${formatRangeCount(filtered.length)}.`,
          checkedAt,
        },
      };
    }
  }

  const staticRanges = filterRelevantRanges(getStaticHolidayRanges());
  const fallbackMessage = primaryError
    ? `Ferienquelle konnte nicht geladen werden: ${primaryError.message}.`
    : "Es wurde auf die statische Ferienliste zurückgegriffen.";

  return {
    ranges: staticRanges,
    status: createStaticFallbackStatus(
      `${fallbackMessage} Verwendet werden ${formatRangeCount(staticRanges.length)}.`,
      checkedAt,
    ),
  };
}

export const getSaxonySchoolHolidayRanges = unstable_cache(
  async (_settingsKey?: string) => {
    void _settingsKey;
    const record = await readSperrlisteSettings();
    const resolved = resolveSperrlisteSettings(record);
    const result = await fetchHolidayRangesForSettings(resolved);
    await applyHolidaySourceStatus(result.status);
    return result.ranges;
  },
  ["saxony-school-holidays"],
  { revalidate: 60 * 60 * 12 },
);
