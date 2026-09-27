"use client";

import { useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { AvailabilityBar } from "@/components/ui/availability-bar";
import { Button } from "@/components/ui/button";
import type { FinderRating, RankedDay } from "@/lib/calendar/date-finder";
import { cn } from "@/lib/utils";

const DAY_LABEL = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const RATING: Record<FinderRating, { label: string; cell: string; text: string }> = {
  good: { label: "Alle können", cell: "bg-success/70", text: "text-success" },
  ok: { label: "Mit Einschränkung", cell: "bg-warning", text: "text-warning" },
  bad: { label: "Benötigte fehlen", cell: "bg-destructive/70", text: "text-destructive" },
};

export function formatFinderDay(dateKey: string) {
  return DAY_LABEL.format(new Date(`${dateKey}T12:00:00Z`));
}

function namesOf(ids: readonly string[], names: Record<string, string>) {
  const list = ids.map((id) => names[id] ?? "Unbekannt");
  return list.length > 4 ? `${list.slice(0, 4).join(", ")} +${list.length - 4}` : list.join(", ");
}

const INITIAL_VISIBLE = 8;

/** Ergebnis des Terminfinders: beste Tage als Liste, alle Tage chronologisch als Heatmap. */
export function DateFinderResults({
  days,
  names,
  onPick,
  pickLabel,
  pendingDateKey,
}: {
  days: readonly RankedDay[];
  names: Record<string, string>;
  onPick: (dateKey: string) => void;
  pickLabel: string;
  /** Tag, für den gerade ein Termin angelegt wird. */
  pendingDateKey?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  if (!days.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Keine Tage im Zeitraum. Wochentage oder Zeitraum anpassen.
      </p>
    );
  }
  const chronological = [...days].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const ranked = focused ? days.filter((day) => day.dateKey === focused) : days;
  const visible = showAll || focused ? ranked : ranked.slice(0, INITIAL_VISIBLE);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1" role="list" aria-label="Alle Tage im Zeitraum">
          {chronological.map((day) => (
            <button
              key={day.dateKey}
              type="button"
              role="listitem"
              onClick={() =>
                setFocused((current) => (current === day.dateKey ? null : day.dateKey))
              }
              className={cn(
                "flex h-11 w-11 flex-col items-center justify-center rounded-md text-[10px] leading-tight text-foreground sm:h-10 sm:w-10",
                RATING[day.rating].cell,
                focused === day.dateKey &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              title={`${formatFinderDay(day.dateKey)}: ${RATING[day.rating].label}`}
              aria-pressed={focused === day.dateKey}
            >
              {formatFinderDay(day.dateKey)
                .split(", ")
                .map((part) => (
                  <span key={part}>{part.replace(/\.$/, "")}</span>
                ))}
            </button>
          ))}
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(Object.keys(RATING) as FinderRating[]).map((rating) => (
            <span key={rating} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm", RATING[rating].cell)} />
              {RATING[rating].label}
            </span>
          ))}
        </p>
      </div>

      <ol className="divide-y divide-border rounded-lg border border-border">
        {visible.map((day) => {
          const total =
            day.required.free +
            day.required.limited +
            day.required.blocked +
            day.required.busy +
            day.optional.free +
            day.optional.limited +
            day.optional.blocked +
            day.optional.busy;
          return (
            <li
              key={day.dateKey}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{formatFinderDay(day.dateKey)}</span>
                  <span className={cn("text-xs font-medium", RATING[day.rating].text)}>
                    {RATING[day.rating].label}
                  </span>
                </div>
                <AvailabilityBar
                  total={total}
                  blocked={
                    day.required.blocked +
                    day.required.busy +
                    day.optional.blocked +
                    day.optional.busy
                  }
                  limited={day.required.limited + day.optional.limited}
                  className="max-w-xs"
                />
                {day.missingRequired.length ? (
                  <p className="text-xs text-muted-foreground">
                    Fehlen: {namesOf(day.missingRequired, names)}
                  </p>
                ) : null}
                {day.limitedRequired.length ? (
                  <p className="text-xs text-muted-foreground">
                    Eingeschränkt: {namesOf(day.limitedRequired, names)}
                  </p>
                ) : null}
              </div>
              <AsyncButton
                type="button"
                size="sm"
                variant={day.rating === "bad" ? "outline" : "default"}
                isLoading={pendingDateKey === day.dateKey}
                loadingText="Legt an…"
                disabled={Boolean(pendingDateKey)}
                onClick={() => onPick(day.dateKey)}
              >
                {pickLabel}
              </AsyncButton>
            </li>
          );
        })}
      </ol>
      {focused ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setFocused(null)}>
          Alle Vorschläge zeigen
        </Button>
      ) : !showAll && ranked.length > INITIAL_VISIBLE ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(true)}>
          Weitere {ranked.length - INITIAL_VISIBLE} Tage
        </Button>
      ) : null}
    </div>
  );
}
