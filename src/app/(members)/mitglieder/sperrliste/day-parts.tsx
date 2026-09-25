"use client";

import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { MapPinIcon } from "@/components/ui/action-icons";
import { getCalendarEntryKindLabel, type CalendarEntry } from "@/lib/calendar/event-kinds";
import { formatIsoTimeInTimeZone } from "@/lib/date-time";
import { DAY_TIER_LABELS, type DayInfo } from "@/lib/sperrliste/day-tiers";
import { cn } from "@/lib/utils";

const LONG_DATE = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatLongDate(date: Date) {
  return LONG_DATE.format(date);
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Kennzeichen eines Tages: Stufe, Endprobenwoche, Ferien/Feiertage. */
export function DayChips({ day, className }: { day: DayInfo; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {day.isFinalWeek ? (
        <Chip className="bg-primary text-primary-foreground">Endprobenwoche</Chip>
      ) : (
        <Chip
          className={
            day.tier === "core"
              ? "bg-foreground/10 text-foreground"
              : day.tier === "possible"
                ? "bg-muted text-foreground/80"
                : "bg-muted/60 text-muted-foreground"
          }
        >
          {DAY_TIER_LABELS[day.tier]}
        </Chip>
      )}
      {day.holidays.map((holiday) => (
        <Chip
          key={holiday.id}
          className={
            holiday.category === "publicHoliday"
              ? "bg-warning/20 text-warning"
              : "bg-info/15 text-info"
          }
        >
          {holiday.title}
        </Chip>
      ))}
    </div>
  );
}

export function formatEntryTime(entry: CalendarEntry) {
  if (entry.allDay) return "ganztägig";
  const start = formatIsoTimeInTimeZone(entry.start);
  return entry.end ? `${start}–${formatIsoTimeInTimeZone(entry.end)}` : start;
}

/** Termine und Proben eines Tages als kompakte Liste. */
export function CalendarEntryList({
  entries,
  onSelect,
}: {
  entries: CalendarEntry[];
  /** Nur für bearbeitbare Termine (Planer). */
  onSelect?: (entry: CalendarEntry) => void;
}) {
  if (!entries.length) return null;
  return (
    <ListRowGroup className="-mx-3">
      {entries.map((entry) => {
        const description = [
          getCalendarEntryKindLabel(entry.kind),
          formatEntryTime(entry),
          entry.location,
        ]
          .filter(Boolean)
          .join(" · ");
        const leading = (
          <span
            aria-hidden
            className={cn(
              "h-8 w-1 rounded-full",
              entry.source === "rehearsal" ? "bg-info" : "bg-primary",
            )}
          />
        );
        if (entry.source === "event" && onSelect) {
          return (
            <ListRow
              key={`${entry.source}-${entry.id}`}
              density="compact"
              leading={leading}
              title={entry.title}
              description={description}
              onClick={() => onSelect(entry)}
            />
          );
        }
        if (entry.href) {
          return (
            <ListRow
              key={`${entry.source}-${entry.id}`}
              density="compact"
              leading={leading}
              title={entry.title}
              description={description}
              href={entry.href}
            />
          );
        }
        return (
          <ListRow
            key={`${entry.source}-${entry.id}`}
            density="compact"
            leading={leading}
            title={entry.title}
            description={description}
            trailing={
              entry.location ? <MapPinIcon className="h-3.5 w-3.5" aria-hidden /> : undefined
            }
          />
        );
      })}
    </ListRowGroup>
  );
}

/** Legende unter den Kalendern. */
export function CalendarLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> Termin
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-info" aria-hidden /> Probe
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-primary" aria-hidden /> Endprobenwoche
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-info/60" aria-hidden /> Ferien
      </span>
    </div>
  );
}

/** Inhalt einer Kalenderzelle am Desktop: Termine mit Uhrzeit, Ferien/Feiertag. */
export function DayCellDetails({
  day,
  entries,
}: {
  day: DayInfo | undefined;
  entries: CalendarEntry[] | undefined;
}) {
  const list = entries ?? [];
  const holiday = day?.holidays.find((entry) => entry.category === "publicHoliday");
  if (!list.length && !holiday) return null;
  return (
    <>
      {list.slice(0, 2).map((entry) => (
        <span
          key={`${entry.source}-${entry.id}`}
          className={cn(
            "flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[0.6875rem] leading-tight",
            entry.source === "rehearsal"
              ? "bg-info/15 text-foreground"
              : "bg-primary/15 text-foreground",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              entry.source === "rehearsal" ? "bg-info" : "bg-primary",
            )}
          />
          {!entry.allDay ? (
            <span className="hidden shrink-0 tabular-nums text-muted-foreground 2xl:inline">
              {formatIsoTimeInTimeZone(entry.start)}
            </span>
          ) : null}
          <span className="truncate font-medium">{entry.title}</span>
        </span>
      ))}
      {list.length > 2 ? (
        <span className="px-1 text-[0.6875rem] text-muted-foreground">
          +{list.length - 2} weitere
        </span>
      ) : null}
      {holiday ? (
        <span className="truncate px-1 text-[0.6875rem] text-warning">{holiday.title}</span>
      ) : null}
    </>
  );
}
