"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import {
  buildScenePlan,
  STALE_DAYS,
  type ScenePlanCell,
  type ScenePlanEntry,
  type ScenePlanRow,
} from "@/lib/calendar/scene-plan";
import { cn } from "@/lib/utils";

export type ScenePlanData = {
  scenes: { id: string; label: string }[];
  entries: ScenePlanEntry[];
  premiereKey: string | null;
};

const SHORT_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

function formatKey(key: string) {
  return SHORT_DATE.format(new Date(`${key}T12:00:00Z`));
}

function sceneNumber(label: string) {
  return label.split(" ")[1] ?? label;
}

function sceneTitle(label: string) {
  return label.split(" ").slice(2).join(" ");
}

function describeRow(row: ScenePlanRow) {
  const parts = [`${row.done}× geprobt`];
  if (row.lastDone) parts.push(`zuletzt ${formatKey(row.lastDone)}`);
  if (row.nextPlanned) parts.push(`nächste ${formatKey(row.nextPlanned)}`);
  return parts.join(" · ");
}

function Cell({
  cell,
  label,
  onOpen,
}: {
  cell: ScenePlanCell;
  label: string;
  onOpen: (dayKey: string) => void;
}) {
  if (!cell.done && !cell.planned) return <span aria-hidden className="block h-8" />;
  const text = [
    cell.done ? `${cell.done}× geprobt` : null,
    cell.planned ? `${cell.planned}× angesetzt` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      onClick={() => onOpen(cell.dayKeys[0] ?? "")}
      title={`${label}: ${text} (${cell.dayKeys.map(formatKey).join(", ")})`}
      aria-label={`${label}: ${text}, im Kalender öffnen`}
      className={cn(
        "flex h-8 w-full items-center justify-center rounded-md text-xs font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cell.done ? "bg-success/20 text-success" : "border border-info bg-info/10 text-info",
      )}
    >
      {cell.done + cell.planned}
    </button>
  );
}

/**
 * Szenen-Plan: welche Szene in welcher Woche geprobt wurde bzw. angesetzt ist – bis zur
 * Premiere. Desktop als Tabelle, mobil als Liste mit Wochenstreifen.
 */
export function ScenePlanView({
  data,
  todayKey,
  onOpenDay,
}: {
  data: ScenePlanData;
  todayKey: string;
  onOpenDay: (dayKey: string) => void;
}) {
  const { weeks, rows } = useMemo(() => buildScenePlan({ ...data, todayKey }), [data, todayKey]);
  const stale = rows.filter((row) => row.stale);

  return (
    <div className="space-y-4">
      <Card variant="plain" size="flush" className="border-border p-4">
        <p className="text-sm text-muted-foreground">
          {stale.length ? (
            <>
              <span className="font-medium text-warning">
                {stale.length} {stale.length === 1 ? "Szene" : "Szenen"} seit über {STALE_DAYS}{" "}
                Tagen nicht geprobt und nicht angesetzt:
              </span>{" "}
              {stale.map((row) => sceneNumber(row.label)).join(", ")}
            </>
          ) : (
            "Alle Szenen sind in den letzten zwei Wochen geprobt oder angesetzt."
          )}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-sm bg-success/20" /> geprobt
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-sm border border-info bg-info/10" />{" "}
            angesetzt
          </span>
          <span>Zahl = Proben in der Woche · Klick öffnet den Tag</span>
        </p>
      </Card>

      {/* Desktop/Tablet: Szene × Woche */}
      <Card variant="plain" size="flush" className="hidden border-border md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-56 border-b border-border bg-card p-2 text-left text-xs font-medium text-muted-foreground"
                >
                  Szene
                </th>
                {weeks.map((week) => (
                  <th
                    key={week.from}
                    scope="col"
                    className={cn(
                      "min-w-12 border-b border-border p-1 text-center text-[0.6875rem] font-medium text-muted-foreground",
                      week.current && "bg-muted text-foreground",
                      week.premiere && "text-primary",
                    )}
                    title={`ab ${formatKey(week.from)}`}
                  >
                    {week.premiere ? "Premiere" : week.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sceneId}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-border bg-card p-2 text-left font-normal"
                  >
                    <span className="block max-w-72 truncate font-medium">
                      {sceneNumber(row.label)} {sceneTitle(row.label)}
                    </span>
                    <span
                      className={cn(
                        "block text-xs",
                        row.stale ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {describeRow(row)}
                    </span>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={weeks[index]?.from}
                      className={cn(
                        "border-b border-border p-1",
                        weeks[index]?.current && "bg-muted",
                      )}
                    >
                      <Cell cell={cell} label={row.label} onOpen={onOpenDay} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Handy: Liste mit Wochenstreifen */}
      <Card variant="plain" size="flush" className="border-border md:hidden">
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.sceneId} className="space-y-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <p className={cn("text-xs", row.stale ? "text-warning" : "text-muted-foreground")}>
                  {describeRow(row)}
                </p>
              </div>
              <div
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
                aria-hidden
              >
                {row.cells.map((cell, index) => (
                  <span
                    key={weeks[index]?.from}
                    className={cn(
                      "h-2 rounded-sm",
                      cell.done
                        ? "bg-success"
                        : cell.planned
                          ? "bg-info"
                          : weeks[index]?.current
                            ? "bg-muted-foreground/30"
                            : "bg-muted",
                    )}
                  />
                ))}
              </div>
              {row.nextPlanned || row.lastDone ? (
                <button
                  type="button"
                  className="min-h-11 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => onOpenDay(row.nextPlanned ?? row.lastDone ?? todayKey)}
                >
                  {row.nextPlanned ? "Nächste Probe öffnen" : "Letzte Probe öffnen"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
