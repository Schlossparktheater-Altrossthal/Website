"use client";

import { useMemo, useState } from "react";
import { addMonths, startOfMonth } from "date-fns";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  MonthGrid,
  type MonthGridDayState,
  type MonthGridMarker,
} from "@/components/ui/month-grid";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { MyEventItem } from "@/lib/calendar/my-events";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";

import { MyEventRow } from "./my-event-row";

const LONG_DATE = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Tagesschlüssel eines Termins in `Europe/Berlin` – wie in der Sperrliste. */
function dayKeyOf(item: MyEventItem) {
  return formatIsoDateInTimeZone(item.start);
}

/** Monatsübersicht der eigenen Termine mit Tagesdetails (Desktop unten, Handy im Sheet). */
export function MyEventsCalendar({ items, todayKey }: { items: MyEventItem[]; todayKey: string }) {
  const byDay = useMemo(() => {
    const map = new Map<string, MyEventItem[]>();
    for (const item of items) {
      const key = dayKeyOf(item);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  // Startmonat aus den Daten ableiten, damit Server und Browser denselben Monat zeigen.
  const firstKey = items.length ? dayKeyOf(items[0]) : todayKey;
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${firstKey}T12:00:00Z`)));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const selectedItems = selectedKey ? (byDay.get(selectedKey) ?? []) : [];
  const selectedTitle = selectedKey
    ? LONG_DATE.format(new Date(`${selectedKey}T12:00:00Z`))
    : "Tag auswählen";

  const getDayState = (key: string): MonthGridDayState => {
    const dayItems = byDay.get(key);
    if (!dayItems?.length) return { isToday: key === todayKey, disabled: true };

    // Eigene Einladungen (mit Absage-Möglichkeit) heben sich von „Für alle" ab.
    const markers: MonthGridMarker[] = dayItems.some((item) => item.decline)
      ? ["rehearsal"]
      : ["event"];
    const titles = dayItems.map((item) => item.title).join(", ");

    return {
      isToday: key === todayKey,
      emphasis: "strong",
      markers,
      description: `${dayItems.length} Termin${dayItems.length === 1 ? "" : "e"}: ${titles}`,
    };
  };

  const rows = (
    <ul>
      {selectedItems.map((item) => (
        <MyEventRow key={`${item.group}-${item.id}`} item={item} />
      ))}
    </ul>
  );

  const selectDay = (key: string) => {
    setSelectedKey(key);
    if (!isDesktop) setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <MonthSwitcher
        month={month}
        onPrevious={() => setMonth((value) => addMonths(value, -1))}
        onNext={() => setMonth((value) => addMonths(value, 1))}
        onToday={() => setMonth(startOfMonth(new Date(`${todayKey}T12:00:00Z`)))}
        isCurrentMonth={month === startOfMonth(new Date(`${todayKey}T12:00:00Z`))}
      />

      <MonthGrid
        month={month}
        selectedKey={isDesktop ? selectedKey : null}
        onSelect={selectDay}
        onMonthChange={setMonth}
        getDayState={getDayState}
        renderDetails={(key) => {
          const dayItems = byDay.get(key);
          if (!dayItems?.length) return null;
          return (
            <span className="line-clamp-2 text-[0.65rem] leading-tight">{dayItems[0].title}</span>
          );
        }}
      />

      {isDesktop ? (
        selectedItems.length ? (
          <section className="space-y-1 border-t border-border pt-3">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {selectedTitle}
            </h3>
            {rows}
          </section>
        ) : (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Wähle einen Tag mit Terminen – die Details stehen dann hier.
          </p>
        )
      ) : null}

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={selectedTitle}
        description="Termine des gewählten Tages"
      >
        {selectedItems.length ? (
          rows
        ) : (
          <p className="text-sm text-muted-foreground">An diesem Tag steht nichts an.</p>
        )}
      </BottomSheet>
    </div>
  );
}
