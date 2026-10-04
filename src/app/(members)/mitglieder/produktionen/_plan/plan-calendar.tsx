"use client";

import * as React from "react";

import { MonthGrid } from "@/components/ui/month-grid";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import type { ProductionPlan } from "@/lib/planning/plan-service";
import { cn } from "@/lib/utils";

import { HEALTH_DOT } from "@/components/production/deadline-health";

const berlinKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(iso));

/** Kalender des Plans: Proben als Punkte, Fristen in Ampelfarbe, Endprobenwoche als Band. */
export function PlanCalendar({
  plan,
  onSelect,
}: {
  plan: ProductionPlan;
  onSelect: (id: string) => void;
}) {
  const today = new Date(plan.today);
  const [month, setMonth] = React.useState(
    () => new Date(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const milestonesByDay = React.useMemo(() => {
    const map = new Map<string, ProductionPlan["milestones"]>();
    for (const milestone of plan.milestones) {
      if (!milestone.dueAt) continue;
      const key = milestone.dueAt.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), milestone]);
    }
    return map;
  }, [plan.milestones]);
  const rehearsalDays = React.useMemo(
    () => new Set(plan.rehearsals.map((event) => berlinKey(event.start))),
    [plan.rehearsals],
  );
  const finalStart = plan.finalRehearsalStart?.slice(0, 10) ?? null;
  const finalEnd = plan.finalRehearsalEnd?.slice(0, 10) ?? finalStart;
  const todayKey = plan.today.slice(0, 10);
  const selected = selectedKey ? (milestonesByDay.get(selectedKey) ?? []) : [];

  const isCurrentMonth =
    month.getFullYear() === today.getUTCFullYear() && month.getMonth() === today.getUTCMonth();

  return (
    <div className="space-y-3">
      <MonthSwitcher
        month={month}
        onPrevious={() =>
          setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))
        }
        onNext={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
        onToday={() => setMonth(new Date(today.getUTCFullYear(), today.getUTCMonth(), 1))}
        isCurrentMonth={isCurrentMonth}
      />
      <MonthGrid
        month={month}
        selectedKey={selectedKey}
        onMonthChange={setMonth}
        onSelect={(key) => {
          const entries = milestonesByDay.get(key) ?? [];
          if (entries.length === 1) onSelect(entries[0].id);
          setSelectedKey(key);
        }}
        getDayState={(key) => {
          const entries = milestonesByDay.get(key) ?? [];
          const markers: ("event" | "rehearsal")[] = [];
          if (entries.length) markers.push("event");
          if (rehearsalDays.has(key)) markers.push("rehearsal");
          const inFinal = finalStart && finalEnd && key >= finalStart && key <= finalEnd;
          return {
            markers,
            band: inFinal ? "final" : undefined,
            isToday: key === todayKey,
            description: entries.map((entry) => entry.title).join(", ") || undefined,
          };
        }}
        renderDetails={(key) =>
          (milestonesByDay.get(key) ?? []).map((entry) => (
            <span key={entry.id} className="flex min-w-0 items-center gap-1 text-[11px]">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", HEALTH_DOT[entry.health])} />
              <span className="truncate">{entry.title}</span>
            </span>
          ))
        }
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" /> Frist
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-info" /> Probe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-primary" /> Endprobenwoche
        </span>
      </div>
      {selected.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry.id)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:bg-muted/50"
            >
              <span className={cn("h-2 w-2 rounded-full", HEALTH_DOT[entry.health])} />
              {entry.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
