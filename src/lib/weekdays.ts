const WEEKDAY_DEFINITIONS = [
  { value: 1, short: "Mo", label: "Montag" },
  { value: 2, short: "Di", label: "Dienstag" },
  { value: 3, short: "Mi", label: "Mittwoch" },
  { value: 4, short: "Do", label: "Donnerstag" },
  { value: 5, short: "Fr", label: "Freitag" },
  { value: 6, short: "Sa", label: "Samstag" },
  { value: 0, short: "So", label: "Sonntag" },
] as const;

type WeekdayDefinition = (typeof WEEKDAY_DEFINITIONS)[number];

export type WeekdayValue = WeekdayDefinition["value"];

export const WEEKDAY_ORDER = WEEKDAY_DEFINITIONS.map((entry) => entry.value) as WeekdayValue[];

const WEEKDAY_MAP = new Map<WeekdayValue, WeekdayDefinition>(
  WEEKDAY_DEFINITIONS.map((entry) => [entry.value, entry]),
);

const LONG_LIST_FORMATTER = new Intl.ListFormat("de-DE", {
  style: "long",
  type: "conjunction",
});

const SHORT_LIST_FORMATTER = new Intl.ListFormat("de-DE", {
  style: "short",
  type: "conjunction",
});

export const WEEKDAY_OPTIONS = WEEKDAY_DEFINITIONS.map((entry) => ({
  value: entry.value,
  short: entry.short,
  label: entry.label,
}));

export function sortWeekdays(values: Iterable<number>) {
  const set = new Set<WeekdayValue>();
  for (const value of values) {
    if (!Number.isInteger(value)) continue;
    if (value < 0 || value > 6) continue;
    set.add(value as WeekdayValue);
  }
  return WEEKDAY_ORDER.filter((weekday) => set.has(weekday));
}

export function formatWeekdayList(
  values: Iterable<number>,
  options: { style?: "long" | "short"; fallback?: string } = {},
) {
  const sorted = sortWeekdays(values);
  if (sorted.length === 0) {
    return options.fallback ?? "";
  }

  const labels = sorted.map((weekday) => {
    const entry = WEEKDAY_MAP.get(weekday);
    if (!entry) {
      return String(weekday);
    }
    return options.style === "short" ? entry.short : entry.label;
  });

  const formatter = options.style === "short" ? SHORT_LIST_FORMATTER : LONG_LIST_FORMATTER;
  return formatter.format(labels);
}

export function getWeekdayLabel(value: number, style: "long" | "short" = "long") {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    return String(value);
  }

  const entry = WEEKDAY_MAP.get(value as WeekdayValue);
  if (!entry) {
    return String(value);
  }
  return style === "short" ? entry.short : entry.label;
}
