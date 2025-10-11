import { prisma } from "@/lib/prisma";
import { databaseEnabled } from "@/lib/dev-database";
import { DEV_SPERRLISTE_SETTINGS_RECORD_FIXTURE } from "@/lib/dev-sperrliste-fixture";
import type { Prisma, SperrlisteSettings } from "@prisma/client";

export const DEFAULT_SAXONY_HOLIDAY_FEED =
  "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics";

export const DEFAULT_SAXONY_PUBLIC_HOLIDAY_FEED =
  "https://www.officeholidays.com/ics/germany/saxony";

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
  publicHolidaySource: {
    mode: HolidaySourceMode;
    url: string | null;
    effectiveUrl: string | null;
  };
  holidayStatus: {
    status: HolidaySourceStatus;
    message: string | null;
    checkedAt: Date | null;
  };
  publicHolidayStatus: {
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
  publicHolidaySource: {
    mode: HolidaySourceMode;
    url: string | null;
    effectiveUrl: string | null;
  };
  holidayStatus: {
    status: HolidaySourceStatus;
    message: string | null;
    checkedAt: string | null;
  };
  publicHolidayStatus: {
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
  publicHolidaySourceMode: HolidaySourceMode;
  publicHolidaySourceUrl: string | null;
};

export type HolidayStatusUpdate = {
  status: HolidaySourceStatus;
  message: string | null;
  checkedAt: Date;
};

export type HolidayStatusUpdates = {
  holiday: HolidayStatusUpdate;
  publicHoliday: HolidayStatusUpdate;
};

const DEFAULT_RECORD_ID = "default" as const;

function cloneRecord(record: SperrlisteSettings): SperrlisteSettings {
  const preferred = Array.isArray(record.preferredWeekdays)
    ? ([...record.preferredWeekdays] as Prisma.JsonValue)
    : record.preferredWeekdays;
  const exceptions = Array.isArray(record.exceptionWeekdays)
    ? ([...record.exceptionWeekdays] as Prisma.JsonValue)
    : record.exceptionWeekdays;

  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    holidaySourceCheckedAt: record.holidaySourceCheckedAt
      ? new Date(record.holidaySourceCheckedAt)
      : null,
    publicHolidaySourceCheckedAt: record.publicHolidaySourceCheckedAt
      ? new Date(record.publicHolidaySourceCheckedAt)
      : null,
    preferredWeekdays: preferred,
    exceptionWeekdays: exceptions,
  };
}

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

function resolveDefaultPublicHolidayUrl() {
  const envValue = normaliseUrl(process.env.SAXONY_PUBLIC_HOLIDAYS_ICS_URL);
  return envValue ?? DEFAULT_SAXONY_PUBLIC_HOLIDAY_FEED;
}

export function getDefaultPublicHolidaySourceUrl() {
  return resolveDefaultPublicHolidayUrl();
}

export type ReadSperrlisteSettingsMeta = {
  record: SperrlisteSettingsRecord;
  offline: boolean;
};

type ReadSperrlisteSettingsOptionsWithMeta = { withMeta: true };
type ReadSperrlisteSettingsOptionsWithoutMeta = { withMeta?: false };
type ReadSperrlisteSettingsOptions =
  | ReadSperrlisteSettingsOptionsWithMeta
  | ReadSperrlisteSettingsOptionsWithoutMeta;

type ReadSperrlisteSettingsResult<
  TOptions extends ReadSperrlisteSettingsOptions | undefined,
> = TOptions extends ReadSperrlisteSettingsOptionsWithMeta
  ? ReadSperrlisteSettingsMeta
  : SperrlisteSettingsRecord;

export async function readSperrlisteSettings<
  TOptions extends ReadSperrlisteSettingsOptions | undefined = undefined,
>(
  options?: TOptions,
): Promise<ReadSperrlisteSettingsResult<TOptions>> {
  const withMeta = options?.withMeta ?? false;

  if (!databaseEnabled()) {
    const record = cloneRecord(DEV_SPERRLISTE_SETTINGS_RECORD_FIXTURE);
    if (withMeta) {
      return {
        record,
        offline: true,
      } as ReadSperrlisteSettingsResult<TOptions>;
    }
    return record as ReadSperrlisteSettingsResult<TOptions>;
  }

  const record = await prisma.sperrlisteSettings.findUnique({
    where: { id: DEFAULT_RECORD_ID },
  });

  if (withMeta) {
    return {
      record,
      offline: false,
    } as ReadSperrlisteSettingsResult<TOptions>;
  }

  return record as ReadSperrlisteSettingsResult<TOptions>;
}

export function resolveSperrlisteSettings(record: SperrlisteSettingsRecord): ResolvedSperrlisteSettings {
  const freezeDays = clampNumber(record?.freezeDays, 0, 365, DEFAULT_FREEZE_DAYS);
  const preferredWeekdays = sanitiseWeekdayJson(record?.preferredWeekdays ?? null, DEFAULT_PREFERRED_WEEKDAYS);
  const exceptionWeekdays = sanitiseWeekdayJson(record?.exceptionWeekdays ?? null, DEFAULT_EXCEPTION_WEEKDAYS);

  const holidaySourceMode = resolveMode(record?.holidaySourceMode);
  const holidaySourceUrl = normaliseUrl(record?.holidaySourceUrl);
  const defaultHolidayUrl = resolveDefaultHolidayUrl();
  const holidayEffectiveUrl =
    holidaySourceMode === "disabled"
      ? null
      : holidaySourceMode === "custom"
        ? holidaySourceUrl
        : defaultHolidayUrl;

  const publicHolidaySourceMode = resolveMode(record?.publicHolidaySourceMode);
  const publicHolidaySourceUrl = normaliseUrl(record?.publicHolidaySourceUrl);
  const defaultPublicUrl = resolveDefaultPublicHolidayUrl();
  const publicHolidayEffectiveUrl =
    publicHolidaySourceMode === "disabled"
      ? null
      : publicHolidaySourceMode === "custom"
        ? publicHolidaySourceUrl
        : defaultPublicUrl;

  const holidayStatus = {
    status: holidaySourceMode === "disabled" ? "disabled" : resolveStatus(record?.holidaySourceStatus),
    message: record?.holidaySourceMessage ?? null,
    checkedAt: record?.holidaySourceCheckedAt ?? null,
  } as const;

  const publicHolidayStatus = {
    status: publicHolidaySourceMode === "disabled" ? "disabled" : resolveStatus(record?.publicHolidaySourceStatus),
    message: record?.publicHolidaySourceMessage ?? null,
    checkedAt: record?.publicHolidaySourceCheckedAt ?? null,
  } as const;

  const cacheKey = [
    `${holidaySourceMode}|${holidayEffectiveUrl ?? "none"}`,
    `${publicHolidaySourceMode}|${publicHolidayEffectiveUrl ?? "none"}`,
  ].join("|");

  return {
    id: record?.id ?? DEFAULT_RECORD_ID,
    freezeDays,
    preferredWeekdays,
    exceptionWeekdays,
    holidaySource: {
      mode: holidaySourceMode,
      url: holidaySourceUrl,
      effectiveUrl: holidayEffectiveUrl,
    },
    publicHolidaySource: {
      mode: publicHolidaySourceMode,
      url: publicHolidaySourceUrl,
      effectiveUrl: publicHolidayEffectiveUrl,
    },
    holidayStatus,
    publicHolidayStatus,
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
    publicHolidaySource: {
      mode: resolved.publicHolidaySource.mode,
      url: resolved.publicHolidaySource.url,
      effectiveUrl: resolved.publicHolidaySource.effectiveUrl,
    },
    holidayStatus: {
      status: resolved.holidayStatus.status,
      message: resolved.holidayStatus.message,
      checkedAt: resolved.holidayStatus.checkedAt
        ? resolved.holidayStatus.checkedAt.toISOString()
        : null,
    },
    publicHolidayStatus: {
      status: resolved.publicHolidayStatus.status,
      message: resolved.publicHolidayStatus.message,
      checkedAt: resolved.publicHolidayStatus.checkedAt
        ? resolved.publicHolidayStatus.checkedAt.toISOString()
        : null,
    },
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    cacheKey: resolved.cacheKey,
  };
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
  options: { resetHolidayStatus?: boolean; resetPublicHolidayStatus?: boolean } = {},
) {
  if (!databaseEnabled()) {
    throw new Error("Sperrlisten-Einstellungen können offline nicht gespeichert werden.");
  }
  const id = DEFAULT_RECORD_ID;
  const resetHolidayStatus = Boolean(options.resetHolidayStatus);
  const resetPublicHolidayStatus = Boolean(options.resetPublicHolidayStatus);
  const preferredWeekdays = toJsonArray(data.preferredWeekdays);
  const exceptionWeekdays = toJsonArray(data.exceptionWeekdays);

  const update: Prisma.SperrlisteSettingsUpdateInput = {
    freezeDays: clampNumber(data.freezeDays, 0, 365, DEFAULT_FREEZE_DAYS),
    holidaySourceMode: data.holidaySourceMode,
    holidaySourceUrl: normaliseUrl(data.holidaySourceUrl),
    publicHolidaySourceMode: data.publicHolidaySourceMode,
    publicHolidaySourceUrl: normaliseUrl(data.publicHolidaySourceUrl),
    preferredWeekdays,
    exceptionWeekdays,
  };

  if (resetHolidayStatus) {
    update.holidaySourceStatus = "unknown";
    update.holidaySourceMessage = null;
    update.holidaySourceCheckedAt = null;
  }

  if (resetPublicHolidayStatus) {
    update.publicHolidaySourceStatus = "unknown";
    update.publicHolidaySourceMessage = null;
    update.publicHolidaySourceCheckedAt = null;
  }

  return prisma.sperrlisteSettings.upsert({
    where: { id },
    update,
    create: {
      id,
      freezeDays: clampNumber(data.freezeDays, 0, 365, DEFAULT_FREEZE_DAYS),
      holidaySourceMode: data.holidaySourceMode,
      holidaySourceUrl: normaliseUrl(data.holidaySourceUrl),
      publicHolidaySourceMode: data.publicHolidaySourceMode,
      publicHolidaySourceUrl: normaliseUrl(data.publicHolidaySourceUrl),
      preferredWeekdays,
      exceptionWeekdays,
    },
  });
}

export async function applyHolidaySourceStatuses(updates: HolidayStatusUpdates) {
  if (!databaseEnabled()) {
    return cloneRecord(DEV_SPERRLISTE_SETTINGS_RECORD_FIXTURE);
  }
  const id = DEFAULT_RECORD_ID;
  const resolvedHolidayStatus =
    updates.holiday.status === "disabled" ? "disabled" : updates.holiday.status;
  const resolvedPublicStatus =
    updates.publicHoliday.status === "disabled" ? "disabled" : updates.publicHoliday.status;
  return prisma.sperrlisteSettings.upsert({
    where: { id },
    update: {
      holidaySourceStatus: resolvedHolidayStatus,
      holidaySourceMessage: updates.holiday.message,
      holidaySourceCheckedAt: updates.holiday.checkedAt,
      publicHolidaySourceStatus: resolvedPublicStatus,
      publicHolidaySourceMessage: updates.publicHoliday.message,
      publicHolidaySourceCheckedAt: updates.publicHoliday.checkedAt,
    },
    create: {
      id,
      holidaySourceMode: "default",
      holidaySourceUrl: null,
      holidaySourceStatus: resolvedHolidayStatus,
      holidaySourceMessage: updates.holiday.message,
      holidaySourceCheckedAt: updates.holiday.checkedAt,
      publicHolidaySourceMode: "default",
      publicHolidaySourceUrl: null,
      publicHolidaySourceStatus: resolvedPublicStatus,
      publicHolidaySourceMessage: updates.publicHoliday.message,
      publicHolidaySourceCheckedAt: updates.publicHoliday.checkedAt,
      freezeDays: DEFAULT_FREEZE_DAYS,
      preferredWeekdays: [...DEFAULT_PREFERRED_WEEKDAYS],
      exceptionWeekdays: [...DEFAULT_EXCEPTION_WEEKDAYS],
    },
  });
}
