"use client";

import { useEffect, useMemo, useState } from "react";

import { CalendarPlusIcon, CalendarRangeIcon } from "@/components/ui/action-icons";
import {
  AVAILABILITY_STATUS,
  StatusBadge,
  StatusLegend,
  type AvailabilityStatus,
} from "@/components/ui/availability-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateBadge } from "@/components/ui/date-badge";
import { Input } from "@/components/ui/input";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { MonthGrid } from "@/components/ui/month-grid";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import { parseDayKey, toDayKey } from "@/lib/sperrliste/day-tiers";
import { cn } from "@/lib/utils";

import { CalendarEntryList, CalendarLegend, DayChips, formatLongDate } from "./day-parts";
import { RangeDialog } from "./range-dialog";
import { KIND_TO_STATUS, type MyBlockedDay } from "./types";
import { getBaseDayState, type CalendarModel } from "./use-calendar-model";

type MyCalendarProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  model: CalendarModel;
  entries: MyBlockedDay[];
  pendingKey: string | null;
  readOnly: boolean;
  freezeDays: number;
  canPlan: boolean;
  onSetDay: (date: string, status: AvailabilityStatus, reason: string | null) => Promise<boolean>;
  onAddRange: (
    dates: string[],
    status: Exclude<AvailabilityStatus, "free">,
    reason: string | null,
  ) => Promise<boolean>;
  onCreateEvent: (date: string) => void;
  onEditEvent: (entry: CalendarEntry) => void;
};

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "free", label: "Frei" },
  { value: "preferred", label: "Bevorzugt" },
  { value: "limited", label: "Eingeschränkt" },
  { value: "blocked", label: "Gesperrt" },
];

const UPCOMING_LIMIT = 6;

export function MyCalendar({
  month,
  onMonthChange,
  model,
  entries,
  pendingKey,
  readOnly,
  freezeDays,
  canPlan,
  onSetDay,
  onAddRange,
  onCreateEvent,
  onEditEvent,
}: MyCalendarProps) {
  const todayKey = toDayKey(new Date());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const entryByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.date, entry])),
    [entries],
  );
  const upcoming = useMemo(
    () => entries.filter((entry) => entry.date >= todayKey),
    [entries, todayKey],
  );

  // Beim Monatswechsel den ersten Tag des Monats wählen (oder heute im aktuellen Monat).
  useEffect(() => {
    const first = model.monthDays[0];
    if (!first) return;
    setSelectedKey((current) => {
      if (model.monthDays.some((day) => day.key === current)) return current;
      return model.monthDays.find((day) => day.isToday)?.key ?? first.key;
    });
  }, [model.monthDays]);

  const selectedDay = model.dayMap.get(selectedKey);
  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start lg:gap-6">
      <Card variant="plain" size="flush" className="space-y-3 p-3 sm:p-4">
        <MonthSwitcher
          month={month}
          isCurrentMonth={isCurrentMonth}
          onPrevious={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          onNext={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          onToday={() => {
            onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
            setSelectedKey(todayKey);
          }}
        />
        <MonthGrid
          month={month}
          selectedKey={selectedKey}
          emphasizedWeekdays={model.preferredWeekdaySet}
          onSelect={(key) => setSelectedKey(key)}
          getDayState={(key) => {
            const entry = entryByDate.get(key);
            return {
              ...getBaseDayState(model.dayMap.get(key), model.entriesByDay.get(key)),
              status: entry ? KIND_TO_STATUS[entry.kind] : undefined,
            };
          }}
        />
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
          <StatusLegend statuses={["preferred", "limited", "blocked"]} />
          <CalendarLegend />
        </div>
      </Card>

      <div className="space-y-4">
        {selectedDay ? (
          <DayPanel
            key={selectedDay.key}
            dayKey={selectedDay.key}
            model={model}
            entry={entryByDate.get(selectedDay.key)}
            pending={pendingKey === selectedDay.key}
            readOnly={readOnly}
            freezeDays={freezeDays}
            canPlan={canPlan}
            onSetDay={onSetDay}
            onCreateEvent={onCreateEvent}
            onEditEvent={onEditEvent}
          />
        ) : null}

        <Card variant="plain" size="flush">
          <div className="p-4 pb-2">
            <SectionHeader
              title="Meine Einträge"
              description={
                upcoming.length
                  ? `${upcoming.length} ${upcoming.length === 1 ? "Tag" : "Tage"} ab heute`
                  : undefined
              }
              action={
                readOnly ? null : (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setRangeOpen(true)}
                  >
                    <CalendarRangeIcon className="h-3.5 w-3.5" aria-hidden />
                    Zeitraum
                  </Button>
                )
              }
            />
          </div>
          <div className="px-1 pb-2">
            {upcoming.length ? (
              <ListRowGroup>
                {(showAll ? upcoming : upcoming.slice(0, UPCOMING_LIMIT)).map((entry) => {
                  const date = parseDayKey(entry.date);
                  return (
                    <ListRow
                      key={entry.id}
                      leading={<DateBadge date={date} />}
                      title={formatLongDate(date)}
                      description={entry.reason ?? undefined}
                      trailing={<StatusBadge status={KIND_TO_STATUS[entry.kind]} />}
                      chevron={false}
                      onClick={() => {
                        onMonthChange(new Date(date.getFullYear(), date.getMonth(), 1));
                        setSelectedKey(entry.date);
                      }}
                    />
                  );
                })}
              </ListRowGroup>
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Keine Einträge – du bist überall verfügbar.
              </p>
            )}
            {upcoming.length > UPCOMING_LIMIT ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="mx-2 mt-1"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? "Weniger anzeigen" : `Alle ${upcoming.length} anzeigen`}
              </Button>
            ) : null}
          </div>
        </Card>
      </div>

      <RangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        initialDate={selectedKey >= todayKey ? selectedKey : todayKey}
        onSubmit={onAddRange}
      />
    </div>
  );
}

type DayPanelProps = {
  dayKey: string;
  model: CalendarModel;
  entry: MyBlockedDay | undefined;
  pending: boolean;
  readOnly: boolean;
  freezeDays: number;
  canPlan: boolean;
  onSetDay: MyCalendarProps["onSetDay"];
  onCreateEvent: MyCalendarProps["onCreateEvent"];
  onEditEvent: MyCalendarProps["onEditEvent"];
};

/** Agenda des gewählten Tages mit eigenem Status – ersetzt den früheren Eintragen-Dialog. */
function DayPanel({
  dayKey,
  model,
  entry,
  pending,
  readOnly,
  freezeDays,
  canPlan,
  onSetDay,
  onCreateEvent,
  onEditEvent,
}: DayPanelProps) {
  const day = model.dayMap.get(dayKey);
  const status: AvailabilityStatus = entry ? KIND_TO_STATUS[entry.kind] : "free";
  const [reason, setReason] = useState(entry?.reason ?? "");
  const calendarEntries = model.entriesByDay.get(dayKey) ?? [];

  useEffect(() => {
    setReason(entry?.reason ?? "");
  }, [entry?.reason]);

  if (!day) return null;

  const locked = readOnly || day.isPast;
  const blockLocked = day.isFrozen;
  const saveReason = () => {
    if (status === "free" || reason.trim() === (entry?.reason ?? "")) return;
    void onSetDay(dayKey, status, reason);
  };

  return (
    <Card variant="plain" size="flush" className="space-y-3 p-4" aria-live="polite">
      <div className="space-y-1.5">
        <SectionHeader
          title={formatLongDate(day.date)}
          action={
            canPlan && !readOnly ? (
              <Button type="button" size="xs" variant="ghost" onClick={() => onCreateEvent(dayKey)}>
                <CalendarPlusIcon className="h-3.5 w-3.5" aria-hidden />
                Termin
              </Button>
            ) : null
          }
        />
        <DayChips day={day} />
      </div>

      {calendarEntries.length ? (
        <CalendarEntryList entries={calendarEntries} onSelect={canPlan ? onEditEvent : undefined} />
      ) : null}

      <div className="space-y-2 border-t border-border/60 pt-3">
        <p className="text-xs font-medium text-muted-foreground">Meine Verfügbarkeit</p>
        <SegmentedControl
          aria-label="Meine Verfügbarkeit an diesem Tag"
          fullWidth
          size="md"
          value={status}
          onValueChange={(next) => {
            if (next === status) return;
            void onSetDay(dayKey, next, next === "free" ? null : reason);
          }}
          options={STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: <span className="truncate">{option.label}</span>,
            ariaLabel: AVAILABILITY_STATUS[option.value].label,
            disabled: locked || pending || (option.value === "blocked" && blockLocked),
          }))}
          activeClassName={(value) =>
            value === "free"
              ? undefined
              : cn(AVAILABILITY_STATUS[value].surface, AVAILABILITY_STATUS[value].text)
          }
          className="[&>button]:px-1.5 [&>button]:text-xs sm:[&>button]:text-sm"
        />
        {status !== "free" && !locked ? (
          <Input
            value={reason}
            maxLength={200}
            placeholder="Grund (optional, sehen nur Planer)"
            aria-label="Grund"
            onChange={(event) => setReason(event.target.value)}
            onBlur={saveReason}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveReason();
              }
            }}
          />
        ) : null}
        {day.isPast ? (
          <p className="text-xs text-muted-foreground">
            Vergangene Tage lassen sich nicht mehr ändern.
          </p>
        ) : blockLocked && status !== "blocked" ? (
          <p className="text-xs text-muted-foreground">
            Sperren ist erst ab {freezeDays} Tagen Vorlauf möglich – „Eingeschränkt“ geht noch.
          </p>
        ) : null}
        {day.isFinalWeek && status === "blocked" ? (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
            Dieser Tag liegt in der Endprobenwoche. Bitte sprich die Abwesenheit mit der Regie ab.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
