const SECONDS_PER_SECOND = 1;
const SECONDS_PER_MINUTE = 60 * SECONDS_PER_SECOND;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;
const SECONDS_PER_MONTH = 30.4375 * SECONDS_PER_DAY;
const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

export type RelativeTimeSegment = {
  unit: Intl.RelativeTimeFormatUnit;
  threshold: number;
  divisor: number;
};

export const RELATIVE_TIME_SEGMENTS = [
  { unit: "second", threshold: SECONDS_PER_MINUTE, divisor: SECONDS_PER_SECOND },
  { unit: "minute", threshold: SECONDS_PER_HOUR, divisor: SECONDS_PER_MINUTE },
  { unit: "hour", threshold: SECONDS_PER_DAY, divisor: SECONDS_PER_HOUR },
  { unit: "day", threshold: SECONDS_PER_WEEK, divisor: SECONDS_PER_DAY },
  { unit: "week", threshold: SECONDS_PER_MONTH, divisor: SECONDS_PER_WEEK },
  { unit: "month", threshold: SECONDS_PER_YEAR, divisor: SECONDS_PER_MONTH },
  { unit: "year", threshold: Number.POSITIVE_INFINITY, divisor: SECONDS_PER_YEAR },
] as const satisfies readonly RelativeTimeSegment[];

export const DEFAULT_RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("de-DE", {
  numeric: "auto",
});

export const DEFAULT_ABSOLUTE_DATETIME_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

type RelativeTimeOptions = {
  formatter?: Intl.RelativeTimeFormat;
  segments?: readonly RelativeTimeSegment[];
  roundingMethod?: (value: number) => number;
};

type RelativeFromNowOptions = RelativeTimeOptions & {
  now?: Date | number;
};

type RelativeWithAbsoluteOptions = RelativeFromNowOptions & {
  absoluteFormatter?: Intl.DateTimeFormat;
  separator?: string;
};

function resolveReferenceDate(now?: Date | number): Date {
  if (now instanceof Date) {
    return now;
  }

  if (typeof now === "number") {
    return new Date(now);
  }

  return new Date();
}

function selectSegment(
  diffInSeconds: number,
  segments: readonly RelativeTimeSegment[],
): { unit: Intl.RelativeTimeFormatUnit; value: number } {
  const absolute = Math.abs(diffInSeconds);

  for (const segment of segments) {
    if (absolute < segment.threshold) {
      return {
        unit: segment.unit,
        value: diffInSeconds / segment.divisor,
      };
    }
  }

  const fallback = segments[segments.length - 1];
  return {
    unit: fallback.unit,
    value: diffInSeconds / fallback.divisor,
  };
}

export function formatRelativeBetween(
  target: Date,
  reference: Date,
  options: RelativeTimeOptions = {},
): string {
  const { formatter = DEFAULT_RELATIVE_TIME_FORMATTER, segments = RELATIVE_TIME_SEGMENTS, roundingMethod = Math.round } =
    options;
  const diffInSeconds = (target.getTime() - reference.getTime()) / 1000;
  const { unit, value } = selectSegment(diffInSeconds, segments);
  return formatter.format(roundingMethod(value), unit);
}

export function formatRelativeFromNow(
  date: Date,
  options: RelativeFromNowOptions = {},
): string {
  const { now, ...rest } = options;
  const reference = resolveReferenceDate(now);
  return formatRelativeBetween(date, reference, rest);
}

export function formatRelativeWithAbsolute(
  date: Date,
  options: RelativeWithAbsoluteOptions = {},
): { relative: string; absolute: string; combined: string } {
  const { absoluteFormatter = DEFAULT_ABSOLUTE_DATETIME_FORMATTER, separator = " • ", ...relativeOptions } = options;
  const relative = formatRelativeFromNow(date, relativeOptions);
  const absolute = absoluteFormatter.format(date);

  return {
    relative,
    absolute,
    combined: `${relative}${separator}${absolute}`,
  };
}
