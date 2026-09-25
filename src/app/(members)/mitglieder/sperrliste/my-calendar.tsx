"use client";

import { useEffect, useMemo, useState } from "react";

import { CalendarPlusIcon, CalendarRangeIcon } from "@/components/ui/action-icons";
import {
  AVAILABILITY_STATUS,
  StatusBadge,
  StatusLegend,
  StatusPicker,
  type AvailabilityStatus,
} from "@/components/ui/availability-status";
import { AsyncButton } from "@/components/ui/async-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateBadge } from "@/components/ui/date-badge";
import { Input } from "@/components/ui/input";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { MonthGrid } from "@/components/ui/month-grid";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { SectionHeader } from "@/components/ui/section-header";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
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
  /** Mehrfachauswahl: gesetzt, solange mehrere Tage gewählt werden. */
  const [multi, setMulti] = useState<Set<string> | null>(null);

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
    if (multi) {
      if (model.dayMap.get(key)?.isPast) return;
      setMulti((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }
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
      showHeader={isDesktop}
      onStartMulti={() => {
        setMulti(new Set([selectedKey]));
        setSheetOpen(false);
      }}
      {...props}
    />
  );
  const selectedDay = model.dayMap.get(selectedKey);
  const createEventButton =
    props.canPlan && !readOnly ? (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setSheetOpen(false);
          props.onCreateEvent(selectedKey);
        }}
      >
        <CalendarPlusIcon className="h-4 w-4" aria-hidden />
        Termin
      </Button>
    ) : null;

  return (
    <div
      className={cn(
        "grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6",
        // Platz für die mobil fixierte Auswahlleiste.
        multi && "pb-48 lg:pb-0",
      )}
    >
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
          selectedKey={multi ? null : isDesktop || sheetOpen ? selectedKey : null}
          selectedKeys={multi ?? undefined}
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
        {multi ? (
          <MultiSelectBar
            count={multi.size}
            onCancel={() => setMulti(null)}
            onApply={async (status, reason) => {
              const ok = await onAddRange([...multi].sort(), status, reason);
              if (ok) setMulti(null);
            }}
          />
        ) : (
          <p className="text-center text-xs text-muted-foreground lg:hidden">
            Tippe auf einen Tag, um dich einzutragen.
          </p>
        )}
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
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={selectedDay ? formatLongDate(selectedDay.date) : ""}
          description="Termine und deine Verfügbarkeit an diesem Tag"
          headerAction={createEventButton}
        >
          {dayDetails}
        </BottomSheet>
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
  showHeader: boolean;
  onStartMulti: () => void;
};

/** Tag mit Terminen und eigener Verfügbarkeit – am Desktop rechts, mobil im Bottom-Sheet. */
function DayDetails({
  dayKey,
  model,
  entry,
  pending,
  showHeader,
  onStartMulti,
  readOnly,
  freezeDays,
  canPlan,
  onSetDay,
  onCreateEvent,
  onEditEvent,
}: DayDetailsProps) {
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
      {showHeader ? <SectionHeader title={title} action={createButton} /> : null}
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
        {!locked ? (
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onStartMulti}>
            <CalendarRangeIcon className="h-4 w-4" aria-hidden />
            Mehrere Tage auswählen
          </Button>
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

const MULTI_STATUSES = ["blocked", "limited", "preferred"] as const;

/** Leiste für die Mehrfachauswahl: mobil unten fixiert, am Desktop unter dem Kalender. */
function MultiSelectBar({
  count,
  onCancel,
  onApply,
}: {
  count: number;
  onCancel: () => void;
  onApply: (status: (typeof MULTI_STATUSES)[number], reason: string | null) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div
      role="region"
      aria-label="Mehrere Tage eintragen"
      className="fixed inset-x-3 bottom-3 z-40 space-y-2 rounded-xl border border-primary/50 bg-card p-3 shadow-lg lg:static lg:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium" aria-live="polite">
          {count === 0
            ? "Tippe auf die Tage, die du eintragen willst"
            : `${count} ${count === 1 ? "Tag" : "Tage"} ausgewählt`}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
      <Input
        value={reason}
        maxLength={200}
        placeholder="Grund (optional, sehen nur Planer)"
        aria-label="Grund für alle ausgewählten Tage"
        className="h-10"
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        {MULTI_STATUSES.map((status) => (
          <AsyncButton
            key={status}
            type="button"
            variant="ghost"
            isLoading={busy === status}
            loadingText="Speichert …"
            disabled={count === 0 || (busy !== null && busy !== status)}
            onClick={async () => {
              setBusy(status);
              await onApply(status, reason.trim() || null);
              setBusy(null);
            }}
            className={cn(
              "h-11 font-semibold hover:opacity-90",
              AVAILABILITY_STATUS[status].surface,
              AVAILABILITY_STATUS[status].text,
            )}
          >
            {AVAILABILITY_STATUS[status].label}
          </AsyncButton>
        ))}
      </div>
    </div>
  );
}
