"use client";

import { useEffect, useMemo, useState } from "react";

import { CalendarPlusIcon, CalendarRangeIcon } from "@/components/ui/action-icons";
import {
  StatusBadge,
  StatusLegend,
  StatusPicker,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import { parseDayKey, toDayKey } from "@/lib/sperrliste/day-tiers";

import {
  CalendarEntryList,
  CalendarLegend,
  DayCellDetails,
  DayChips,
  formatLongDate,
} from "./day-parts";
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

const UPCOMING_LIMIT = 5;

export function MyCalendar(props: MyCalendarProps) {
  const { month, onMonthChange, model, entries, readOnly, onAddRange } = props;
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const todayKey = toDayKey(new Date());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [sheetOpen, setSheetOpen] = useState(false);
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

  // Beim Monatswechsel am Desktop einen Tag des neuen Monats wählen (heute oder den 1.).
  useEffect(() => {
    const first = model.monthDays[0];
    if (!first) return;
    setSelectedKey((current) => {
      if (model.monthDays.some((day) => day.key === current)) return current;
      return model.monthDays.find((day) => day.isToday)?.key ?? first.key;
    });
  }, [model.monthDays]);

  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  const selectDay = (key: string) => {
    setSelectedKey(key);
    // Mobil öffnet ein Tipp sofort das Blatt – so ist klar, dass sich etwas tut.
    if (!isDesktop) setSheetOpen(true);
  };

  const dayDetails = (
    <DayDetails
      key={selectedKey}
      dayKey={selectedKey}
      entry={entryByDate.get(selectedKey)}
      pending={props.pendingKey === selectedKey}
      {...props}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
      <Card variant="plain" size="flush" className="space-y-3 border-border p-3 sm:p-4">
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
          showWeekNumbers
          selectedKey={isDesktop || sheetOpen ? selectedKey : null}
          emphasizedWeekdays={model.preferredWeekdaySet}
          onSelect={selectDay}
          getDayState={(key) => {
            const entry = entryByDate.get(key);
            return {
              ...getBaseDayState(model.dayMap.get(key), model.entriesByDay.get(key)),
              status: entry ? KIND_TO_STATUS[entry.kind] : undefined,
            };
          }}
          renderDetails={(key) => (
            <DayCellDetails day={model.dayMap.get(key)} entries={model.entriesByDay.get(key)} />
          )}
        />
        <p className="text-center text-xs text-muted-foreground lg:hidden">
          Tippe auf einen Tag, um dich einzutragen.
        </p>
        <div className="flex flex-col gap-1.5 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <StatusLegend statuses={["preferred", "limited", "blocked"]} />
          <CalendarLegend />
        </div>
      </Card>

      <div className="space-y-4">
        {isDesktop ? (
          <Card variant="plain" size="flush" className="border-border p-4" aria-live="polite">
            {dayDetails}
          </Card>
        ) : null}

        <Card variant="plain" size="flush" className="border-border">
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
                    size="sm"
                    variant="outline"
                    onClick={() => setRangeOpen(true)}
                  >
                    <CalendarRangeIcon className="h-4 w-4" aria-hidden />
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
                        selectDay(entry.date);
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
                size="sm"
                className="mx-2 mt-1"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? "Weniger anzeigen" : `Alle ${upcoming.length} anzeigen`}
              </Button>
            ) : null}
          </div>
        </Card>
      </div>

      {!isDesktop ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-3"
          >
            <span
              aria-hidden
              className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-muted-foreground/30"
            />
            {dayDetails}
          </SheetContent>
        </Sheet>
      ) : null}

      <RangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        initialDate={selectedKey >= todayKey ? selectedKey : todayKey}
        onSubmit={onAddRange}
      />
    </div>
  );
}

type DayDetailsProps = MyCalendarProps & {
  dayKey: string;
  entry: MyBlockedDay | undefined;
  pending: boolean;
};

/** Tag mit Terminen und eigener Verfügbarkeit – am Desktop rechts, mobil im Bottom-Sheet. */
function DayDetails({
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
}: DayDetailsProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const day = model.dayMap.get(dayKey);
  const status: AvailabilityStatus = entry ? KIND_TO_STATUS[entry.kind] : "free";
  const [reason, setReason] = useState(entry?.reason ?? "");
  const calendarEntries = model.entriesByDay.get(dayKey) ?? [];

  useEffect(() => {
    setReason(entry?.reason ?? "");
  }, [entry?.reason]);

  if (!day) return null;

  const locked = readOnly || day.isPast;
  const saveReason = () => {
    if (status === "free" || reason.trim() === (entry?.reason ?? "")) return;
    void onSetDay(dayKey, status, reason);
  };

  const title = formatLongDate(day.date);
  const createButton =
    canPlan && !readOnly ? (
      <Button type="button" size="sm" variant="ghost" onClick={() => onCreateEvent(dayKey)}>
        <CalendarPlusIcon className="h-4 w-4" aria-hidden />
        Termin
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      {isDesktop ? (
        <SectionHeader title={title} action={createButton} />
      ) : (
        <SheetHeader className="space-y-0 text-left">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {createButton}
          </div>
          <SheetDescription className="sr-only">
            Termine und deine Verfügbarkeit an diesem Tag
          </SheetDescription>
        </SheetHeader>
      )}
      <DayChips day={day} />

      <section className="space-y-1">
        <h3 className="text-xs font-medium text-muted-foreground">Termine</h3>
        {calendarEntries.length ? (
          <CalendarEntryList
            entries={calendarEntries}
            onSelect={canPlan ? onEditEvent : undefined}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Keine Termine.</p>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h3 className="text-xs font-medium text-muted-foreground">Meine Verfügbarkeit</h3>
        <StatusPicker
          value={status}
          disabled={locked || pending}
          isDisabled={(value) => value === "blocked" && day.isFrozen && status !== "blocked"}
          onValueChange={(next) => {
            if (next === status) return;
            void onSetDay(dayKey, next, next === "free" ? null : reason);
          }}
          className="lg:grid-cols-2"
        />
        {status !== "free" && !locked ? (
          <Input
            value={reason}
            maxLength={200}
            placeholder="Grund (optional, sehen nur Planer)"
            aria-label="Grund"
            className="h-11"
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
        ) : day.isFrozen && status !== "blocked" ? (
          <p className="text-xs text-muted-foreground">
            Sperren ist erst ab {freezeDays} Tagen Vorlauf möglich – „Eingeschränkt“ geht noch.
          </p>
        ) : null}
        {day.isFinalWeek && status === "blocked" ? (
          <p className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-xs text-warning">
            Dieser Tag liegt in der Endprobenwoche. Bitte sprich die Abwesenheit mit der Regie ab.
          </p>
        ) : null}
      </section>
    </div>
  );
}
