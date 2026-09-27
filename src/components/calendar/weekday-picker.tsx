"use client";

import { cn } from "@/lib/utils";

/** Montag zuerst; Werte wie `Date.getDay()` (0 = Sonntag). */
const WEEKDAYS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 0, label: "So" },
];

/** Mehrfachauswahl von Wochentagen als Chips; keine Auswahl = alle Tage. */
export function WeekdayPicker({
  value,
  onChange,
}: {
  value: readonly number[];
  onChange: (value: number[]) => void;
}) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((entry) => entry !== day) : [...value, day]);
  return (
    <div
      className="grid grid-cols-7 gap-1.5 sm:flex sm:flex-wrap"
      role="group"
      aria-label="Wochentage"
    >
      {WEEKDAYS.map((day) => {
        const active = value.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(day.value)}
            className={cn(
              "h-11 rounded-md border text-sm font-medium transition-colors sm:h-9 sm:min-w-11 sm:px-3",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}
