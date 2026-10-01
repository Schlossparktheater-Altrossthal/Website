"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { DateBadge } from "@/components/ui/date-badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import type { PlanMilestone, PlanRehearsal } from "@/lib/planning/plan-service";
import { toDay } from "@/lib/planning/schedule";
import { cn } from "@/lib/utils";

import { DeadlineBadge } from "./deadline-badge";
import { HEALTH_DOT } from "./health";

type AgendaGroup = "overdue" | "thisWeek" | "nextWeek" | "later" | "unscheduled";

const GROUP_LABELS: Record<AgendaGroup, string> = {
  overdue: "Überfällig",
  thisWeek: "Diese Woche",
  nextWeek: "Nächste Woche",
  later: "Später",
  unscheduled: "Ohne Datum",
};

const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

type Entry =
  | { type: "milestone"; day: number; milestone: PlanMilestone }
  | { type: "rehearsal"; day: number; rehearsal: PlanRehearsal };

/** Tag (Berlin) eines Termins als Tageszahl, passend zu den Fristen (UTC-Mitternacht). */
function berlinDay(iso: string): number {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(iso));
  return toDay(new Date(`${key}T00:00:00.000Z`));
}

export function milestoneMeta(milestone: PlanMilestone): string {
  return [
    milestone.department?.name,
    milestone.tasksTotal ? `${milestone.tasksDone}/${milestone.tasksTotal} Karten` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Mobile Agenda ab heute (docs/Plan/projektplanung-plan.md, „Mobil – Agenda“): Gruppen nach
 * Woche, Zeilen im Stil von „Nächste Termine“, Proben grau dazwischen als Kontext.
 */
export function PlanAgenda({
  milestones,
  rehearsals,
  today,
  onlyOverdue,
  onSelect,
}: {
  milestones: PlanMilestone[];
  rehearsals: PlanRehearsal[];
  today: string;
  onlyOverdue: boolean;
  onSelect: (id: string) => void;
}) {
  const [showDone, setShowDone] = React.useState(false);
  const todayDay = toDay(new Date(today));
  // Wochen beginnen montags.
  const weekday = (new Date(today).getUTCDay() + 6) % 7;
  const endOfWeek = todayDay + (6 - weekday);
  const endOfNextWeek = endOfWeek + 7;

  const open = milestones.filter((milestone) => !milestone.doneAt);
  const done = milestones.filter((milestone) => milestone.doneAt);

  const groupOf = (milestone: PlanMilestone, day: number | null): AgendaGroup => {
    if (day === null) return "unscheduled";
    if (milestone.health === "overdue" || day < todayDay) return "overdue";
    if (day <= endOfWeek) return "thisWeek";
    if (day <= endOfNextWeek) return "nextWeek";
    return "later";
  };

  const groups = new Map<AgendaGroup, Entry[]>();
  for (const milestone of open) {
    const day = milestone.dueAt ? toDay(new Date(milestone.dueAt)) : null;
    const group = groupOf(milestone, day);
    if (onlyOverdue && group !== "overdue") continue;
    groups.set(group, [
      ...(groups.get(group) ?? []),
      { type: "milestone", day: day ?? 0, milestone },
    ]);
  }
  if (!onlyOverdue) {
    for (const rehearsal of rehearsals) {
      const day = berlinDay(rehearsal.start);
      if (day < todayDay || day > endOfNextWeek) continue;
      const group: AgendaGroup = day <= endOfWeek ? "thisWeek" : "nextWeek";
      groups.set(group, [...(groups.get(group) ?? []), { type: "rehearsal", day, rehearsal }]);
    }
  }

  const order: AgendaGroup[] = ["overdue", "thisWeek", "nextWeek", "later", "unscheduled"];
  const visible = order.filter((group) =>
    (groups.get(group) ?? []).some((entry) => entry.type === "milestone"),
  );

  return (
    <div className="space-y-5">
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {onlyOverdue ? "Nichts überfällig." : "Keine offenen Fristen."}
        </p>
      ) : null}
      {visible.map((group) => {
        const entries = [...(groups.get(group) ?? [])].sort(
          (a, b) => a.day - b.day || (a.type === "rehearsal" ? -1 : 1),
        );
        return (
          <section key={group} className="space-y-2" aria-labelledby={`agenda-${group}`}>
            <h3
              id={`agenda-${group}`}
              className={cn(
                "text-sm font-medium",
                group === "overdue" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {GROUP_LABELS[group]}
            </h3>
            <ListRowGroup variant="inset" className="bg-card">
              {entries.map((entry) =>
                entry.type === "milestone" ? (
                  <MilestoneRow
                    key={entry.milestone.id}
                    milestone={entry.milestone}
                    onSelect={onSelect}
                  />
                ) : (
                  <ListRow
                    key={entry.rehearsal.id}
                    density="compact"
                    className="text-muted-foreground"
                    leading={
                      <span className="w-11 text-center text-xs tabular-nums">
                        {TIME_FORMAT.format(new Date(entry.rehearsal.start))}
                      </span>
                    }
                    title={
                      <span className="font-normal text-muted-foreground">
                        {entry.rehearsal.title}
                      </span>
                    }
                    description={new Intl.DateTimeFormat("de-DE", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "Europe/Berlin",
                    }).format(new Date(entry.rehearsal.start))}
                  />
                ),
              )}
            </ListRowGroup>
          </section>
        );
      })}
      {done.length && !onlyOverdue ? (
        <section className="space-y-2">
          <Button variant="ghost" size="xs" onClick={() => setShowDone((value) => !value)}>
            {showDone ? "Erledigte ausblenden" : `${done.length} erledigt anzeigen`}
          </Button>
          {showDone ? (
            <ListRowGroup variant="inset" className="bg-card">
              {done.map((milestone) => (
                <MilestoneRow key={milestone.id} milestone={milestone} onSelect={onSelect} />
              ))}
            </ListRowGroup>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function MilestoneRow({
  milestone,
  onSelect,
}: {
  milestone: PlanMilestone;
  onSelect: (id: string) => void;
}) {
  const due = milestone.dueAt ? new Date(milestone.dueAt) : null;
  return (
    <ListRow
      onClick={() => onSelect(milestone.id)}
      leading={
        due ? (
          <DateBadge date={due} tone={milestone.health === "overdue" ? "primary" : "muted"} />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-muted/60 text-xs text-muted-foreground">
            –
          </span>
        )
      }
      title={
        <span className={cn(milestone.doneAt && "text-muted-foreground line-through")}>
          {milestone.title}
        </span>
      }
      description={milestoneMeta(milestone) || undefined}
      trailing={
        <>
          <span
            className={cn("h-2.5 w-2.5 rounded-full", HEALTH_DOT[milestone.health])}
            aria-hidden
          />
          {due ? <DeadlineBadge dueAt={due} health={milestone.health} /> : null}
        </>
      }
    />
  );
}
