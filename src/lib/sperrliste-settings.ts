import { prisma } from "@/lib/prisma";
import type { Prisma, SperrlisteSettings } from "@prisma/client";

export const DEFAULT_SAXONY_HOLIDAY_FEED =
  "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics";

export const DEFAULT_FREEZE_DAYS = 7;
export const DEFAULT_PREFERRED_WEEKDAYS = [6, 0] as const;
export const DEFAULT_EXCEPTION_WEEKDAYS = [5] as const;

export const HOLIDAY_SOURCE_MODES = ["default", "custom", "disabled"] as const;
export type HolidaySourceMode = (typeof HOLIDAY_SOURCE_MODES)[number];

export const HOLIDAY_SOURCE_STATUSES = [
  "unknown",
  "ok",
  "error",
  "disabled",
] as const;
export type HolidaySourceStatus = (typeof HOLIDAY_SOURCE_STATUSES)[number];

export type SperrlisteSettingsRecord = SperrlisteSettings | null;

export type ResolvedSperrlisteSettings = {
  id: string;
  freezeDays: number;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
  holidaySource: {
    mode: HolidaySourceMode;
    url: string | null;
    effectiveUrl: string | null;
  };
  holidayStatus: {
    status: HolidaySourceStatus;
    message: string | null;
    checkedAt: Date | null;
  };
  updatedAt: Date | null;
  cacheKey: string;
};

export type ResolvedHolidaySourceStatus = ResolvedSperrlisteSettings["holidayStatus"];

export type ClientSperrlisteSettings = {
  freezeDays: number;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
  holidaySource: {
    mode: HolidaySourceMode;
    url: string | null;
    effectiveUrl: string | null;
  };
  holidayStatus: {
    status: HolidaySourceStatus;
    message: string | null;
    checkedAt: string | null;
  };
  updatedAt: string | null;
  cacheKey: string;
};

export type SperrlisteSettingsInput = {
  freezeDays: number;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
  holidaySourceMode: HolidaySourceMode;
  holidaySourceUrl: string | null;
};

export type HolidayStatusUpdate = {
  status: HolidaySourceStatus;
  message: string | null;
  checkedAt: Date;
};

const DEFAULT_RECORD_ID = "default" as const;

function normaliseUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.round(value);
  if (rounded < minimum) return minimum;
  if (rounded > maximum) return maximum;
  return rounded;
}

const WEEKDAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];

function sanitiseWeekdayJson(value: Prisma.JsonValue | null | undefined, fallback: readonly number[]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const set = new Set<number>();
  for (const entry of value) {
    if (typeof entry === "number" && Number.isInteger(entry) && entry >= 0 && entry <= 6) {
      set.add(entry);
      continue;
    }
    if (typeof entry === "string") {
      const parsed = Number.parseInt(entry, 10);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6) {
        set.add(parsed);
      }
    }
  }

  if (set.size === 0) {
    return [];
  }

  return WEEKDAY_ORDER.filter((weekday) => set.has(weekday));
}

function resolveMode(value: unknown): HolidaySourceMode {
  if (typeof value !== "string") {
    return "default";
  }
  const normalised = value.trim().toLowerCase();
  if (HOLIDAY_SOURCE_MODES.includes(normalised as HolidaySourceMode)) {
    return normalised as HolidaySourceMode;
  }
  return "default";
}

function resolveStatus(value: unknown): HolidaySourceStatus {
  if (typeof value !== "string") {
    return "unknown";
  }
  const normalised = value.trim().toLowerCase();
  if (HOLIDAY_SOURCE_STATUSES.includes(normalised as HolidaySourceStatus)) {
    return normalised as HolidaySourceStatus;
  }
  return "unknown";
}

function resolveDefaultHolidayUrl() {
  const envValue = normaliseUrl(process.env.SAXONY_HOLIDAYS_ICS_URL);
  return envValue ?? DEFAULT_SAXONY_HOLIDAY_FEED;
}

export function getDefaultHolidaySourceUrl() {
  return resolveDefaultHolidayUrl();
}

export function resolveSperrlisteSettings(record: SperrlisteSettingsRecord): ResolvedSperrlisteSettings {
  const mode = resolveMode(record?.holidaySourceMode);
  const url = normaliseUrl(record?.holidaySourceUrl);
  const freezeDays = clampNumber(record?.freezeDays, 0, 365, DEFAULT_FREEZE_DAYS);
  const preferredWeekdays = sanitiseWeekdayJson(record?.preferredWeekdays ?? null, DEFAULT_PREFERRED_WEEKDAYS);
  const exceptionWeekdays = sanitiseWeekdayJson(record?.exceptionWeekdays ?? null, DEFAULT_EXCEPTION_WEEKDAYS);
  const effectiveUrl = mode === "disabled" ? null : mode === "custom" ? url : resolveDefaultHolidayUrl();

  const resolvedStatus = mode === "disabled" ? "disabled" : resolveStatus(record?.holidaySourceStatus);

  const holidayStatus = {
    status: resolvedStatus,
    message: record?.holidaySourceMessage ?? null,
    checkedAt: record?.holidaySourceCheckedAt ?? null,
  } as const;

  const cacheKey = `${mode}|${effectiveUrl ?? "none"}`;

  return {
    id: record?.id ?? DEFAULT_RECORD_ID,
    freezeDays,
    preferredWeekdays,
    exceptionWeekdays,
    holidaySource: {
      mode,
      url,
      effectiveUrl,
    },
    holidayStatus,
    updatedAt: record?.updatedAt ?? null,
    cacheKey,
  };
}

export function toClientSperrlisteSettings(
  resolved: ResolvedSperrlisteSettings,
): ClientSperrlisteSettings {
  return {
    freezeDays: resolved.freezeDays,
    preferredWeekdays: [...resolved.preferredWeekdays],
    exceptionWeekdays: [...resolved.exceptionWeekdays],
    holidaySource: {
      mode: resolved.holidaySource.mode,
      url: resolved.holidaySource.url,
      effectiveUrl: resolved.holidaySource.effectiveUrl,
    },
    holidayStatus: {
      status: resolved.holidayStatus.status,
      message: resolved.holidayStatus.message,
      checkedAt: resolved.holidayStatus.checkedAt
        ? resolved.holidayStatus.checkedAt.toISOString()
        : null,
    },
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    cacheKey: resolved.cacheKey,
  };
}

export async function readSperrlisteSettings() {
  return prisma.sperrlisteSettings.findUnique({ where: { id: DEFAULT_RECORD_ID } });
}

function toJsonArray(values: number[]) {
  const set = new Set<number>();
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const rounded = Math.trunc(value);
    if (!Number.isInteger(rounded) || rounded < 0 || rounded > 6) continue;
    set.add(rounded);
  }

  if (set.size === 0) {
    return [] as number[];
  }

  return WEEKDAY_ORDER.filter((weekday) => set.has(weekday));
}

export async function saveSperrlisteSettings(
  data: SperrlisteSettingsInput,
  options: { resetStatus?: boolean } = {},
) {
  const id = DEFAULT_RECORD_ID;
  const resetStatus = Boolean(options.resetStatus);
  const preferredWeekdays = toJsonArray(data.preferredWeekdays);
  const exceptionWeekdays = toJsonArray(data.exceptionWeekdays);

  const update: Prisma.SperrlisteSettingsUpdateInput = {
    freezeDays: clampNumber(data.freezeDays, 0, 365, DEFAULT_FREEZE_DAYS),
    holidaySourceMode: data.holidaySourceMode,
    holidaySourceUrl: normaliseUrl(data.holidaySourceUrl),
    preferredWeekdays,
    exceptionWeekdays,
  };

  if (resetStatus) {
    update.holidaySourceStatus = "unknown";
    update.holidaySourceMessage = null;
    update.holidaySourceCheckedAt = null;
  }

  return prisma.sperrlisteSettings.upsert({
    where: { id },
    update,
    create: {
      id,
      freezeDays: clampNumber(data.freezeDays, 0, 365, DEFAULT_FREEZE_DAYS),
      holidaySourceMode: data.holidaySourceMode,
      holidaySourceUrl: normaliseUrl(data.holidaySourceUrl),
      preferredWeekdays,
      exceptionWeekdays,
    },
  });
}

export async function applyHolidaySourceStatus(update: HolidayStatusUpdate) {
  const id = DEFAULT_RECORD_ID;
  const resolvedStatus = update.status === "disabled" ? "disabled" : update.status;
  return prisma.sperrlisteSettings.upsert({
    where: { id },
    update: {
      holidaySourceStatus: resolvedStatus,
      holidaySourceMessage: update.message,
      holidaySourceCheckedAt: update.checkedAt,
    },
    create: {
      id,
      holidaySourceMode: "default",
      holidaySourceUrl: null,
      holidaySourceStatus: resolvedStatus,
      holidaySourceMessage: update.message,
      holidaySourceCheckedAt: update.checkedAt,
      freezeDays: DEFAULT_FREEZE_DAYS,
      preferredWeekdays: [...DEFAULT_PREFERRED_WEEKDAYS],
      exceptionWeekdays: [...DEFAULT_EXCEPTION_WEEKDAYS],
    },
  });
}
