"use client";

import * as React from "react";

import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  TrophyIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import type { TokenizedBlock } from "@/lib/skript/learn/chunks";
import {
  confidenceHistory,
  cueWeaknesses,
  dailyCounts,
  milestones,
  forecast,
  problemUnits,
  type HistoryEntry,
} from "@/lib/skript/learn/insights";
import type { QueueInput } from "@/lib/skript/learn/plan";
import type { ScriptReaderData } from "@/lib/skript/reader";
import { cn } from "@/lib/utils";

import { CountUp } from "./celebrate";
import { ConfidenceChart } from "./confidence-chart";
import type { Unit } from "./model";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Statistik des Lernmodus (docs/Plan/lernmodus-plan.md, Runde 2): privat, nur für sich. */
export function LearnStats({
  reader,
  tokenized,
  input,
  history,
  byId,
  weeklyDays,
  onExit,
  onDrill,
  onFlow,
}: {
  reader: ScriptReaderData;
  tokenized: ReadonlyMap<string, TokenizedBlock>;
  input: QueueInput;
  history: readonly HistoryEntry[];
  byId: ReadonlyMap<string, Unit>;
  weeklyDays: number;
  onExit: () => void;
  onDrill: (units: Unit[], title: string) => void;
  onFlow: (sceneId: string) => void;
}) {
  const ownKeys = React.useMemo(() => new Set(input.items.map((item) => item.key)), [input.items]);
  const ownHistory = React.useMemo(
    () => history.filter((entry) => ownKeys.has(entry.key)),
    [history, ownKeys],
  );
  const days = React.useMemo(() => dailyCounts(ownHistory, input.now), [ownHistory, input.now]);
  const prognosis = React.useMemo(() => forecast(input), [input]);
  const problems = React.useMemo(() => problemUnits(input), [input]);
  const trend = React.useMemo(() => confidenceHistory(input, ownHistory), [input, ownHistory]);
  const badges = React.useMemo(
    () => milestones(input, ownHistory, weeklyDays),
    [input, ownHistory, weeklyDays],
  );
  const cues = React.useMemo(
    () => cueWeaknesses(ownHistory, input.items),
    [ownHistory, input.items],
  );

  const weekTotal = days.slice(-7).reduce((sum, day) => sum + day.count, 0);
  const studyDays = days.filter((day) => day.count > 0).length;
  const max = Math.max(1, ...days.map((day) => day.count));
  const sceneTitle = (id: string) => reader.scenes.find((scene) => scene.id === id)?.title ?? "";
  const snippet = (unitId: string) => {
    const unit = byId.get(unitId);
    const words = unit ? tokenized.get(unit.block.id)?.chunks[unit.chunk]?.words : undefined;
    if (!words) return "";
    return words.length > 9 ? `${words.slice(0, 9).join(" ")} …` : words.join(" ");
  };
  const units = (ids: readonly string[]) =>
    ids.map((id) => byId.get(id)).filter((unit): unit is Unit => !!unit);

  return (
    <div className="min-h-dvh pb-12">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-1">
          <Button variant="ghost" size="icon" aria-label="Zurück zur Übersicht" onClick={onExit}>
            <ArrowLeftIcon aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium">Dein Lernstand</h1>
            <p className="truncate text-xs text-muted-foreground">Nur für dich sichtbar</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-7 px-4 pt-4" data-testid="lernen-statistik">
        <section aria-labelledby="stat-prognose">
          <h2 id="stat-prognose" className="text-sm font-medium">
            Wie lange sitzt der Text?
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Textsicherheit, wenn du ab heute nicht mehr lernst
          </p>
          {prognosis[0].value < 0.05 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Noch kaum etwas gelernt – nach ein paar Abfragen siehst du hier, wie lange dein Text
              hält.
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-4 items-end gap-2" style={{ height: 120 }}>
            {prognosis.map((entry) => (
              <div key={entry.days} className="flex h-full flex-col justify-end gap-1 text-center">
                <span className="text-xs font-semibold">
                  <CountUp value={entry.value * 100} format={(value) => `${Math.round(value)} %`} />
                </span>
                <span
                  className={cn(
                    "w-full origin-bottom rounded-t-sm transition-[height] duration-700",
                    entry.value >= 0.9
                      ? "bg-success"
                      : entry.value >= 0.6
                        ? "bg-primary"
                        : "bg-warning",
                  )}
                  style={{ height: `${Math.max(3, entry.value * 80)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-4 gap-2 text-center text-[11px] text-muted-foreground">
            {prognosis.map((entry) => (
              <span key={entry.days}>{entry.days ? `in ${entry.days} Tagen` : "heute"}</span>
            ))}
          </div>
        </section>

        <section aria-labelledby="stat-verlauf">
          <h2 id="stat-verlauf" className="text-sm font-medium">
            Textsicherheit im Verlauf
          </h2>
          <ConfidenceChart points={trend} />
        </section>

        <section aria-labelledby="stat-tage">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="stat-tage" className="text-sm font-medium">
              Lerntage
            </h2>
            <span className="text-xs text-muted-foreground">
              {studyDays} {studyDays === 1 ? "Tag" : "Tage"} in 12 Wochen · diese Woche {weekTotal}{" "}
              Abfragen
            </span>
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <div className="grid grid-rows-7 gap-[3px] text-[9px] leading-none text-muted-foreground">
              {WEEKDAYS.map((day) => (
                <span key={day} className="flex h-3.5 items-center">
                  {day}
                </span>
              ))}
            </div>
            <div
              className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]"
              role="img"
              aria-label={`${studyDays} Lerntage in den letzten 12 Wochen`}
            >
              {days.map((day) => (
                <span
                  key={day.day}
                  title={`${new Date(day.day).toLocaleDateString("de-DE")}: ${day.count} Abfragen`}
                  className={cn(
                    "h-3.5 rounded-[2px]",
                    day.count ? "bg-primary" : "bg-muted-foreground/12",
                  )}
                  style={day.count ? { opacity: 0.35 + 0.65 * (day.count / max) } : undefined}
                />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="stat-meilensteine">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="stat-meilensteine" className="text-sm font-medium">
              Meilensteine
            </h2>
            <span className="text-xs text-muted-foreground">
              {badges.filter((badge) => badge.achieved).length} von {badges.length}
            </span>
          </div>
          <ul
            className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
            data-testid="lernen-meilensteine"
          >
            {badges.map((badge) => (
              <li
                key={badge.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  badge.achieved ? "border-success/40 bg-success/10" : "border-border",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    badge.achieved
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {badge.achieved ? (
                    <CheckIcon className="h-5 w-5" />
                  ) : (
                    <TrophyIcon className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{badge.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {badge.achieved
                      ? badge.detail
                      : `${badge.detail} · ${badge.current}/${badge.target}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="stat-problem">
          <h2 id="stat-problem" className="text-sm font-medium">
            Schwierige Stellen
          </h2>
          {problems.length ? (
            <>
              <ul className="mt-2 divide-y divide-border/60 border-y border-border/60">
                {problems.map((entry) => (
                  <li key={entry.unitId} className="py-2">
                    <p className="truncate text-sm">{snippet(entry.unitId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {sceneTitle(entry.sceneId)}
                      {entry.lapses ? ` · ${entry.lapses}× vergessen` : " · fällt dir noch schwer"}
                    </p>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-3 w-full sm:w-auto"
                onClick={() =>
                  onDrill(units(problems.map((entry) => entry.unitId)), "Schwierige Stellen")
                }
              >
                Nur die üben
              </Button>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Noch keine – Stellen, die du öfter vergisst, tauchen hier auf.
            </p>
          )}
        </section>

        <section aria-labelledby="stat-stichwort">
          <h2 id="stat-stichwort" className="text-sm font-medium">
            Text sitzt, Einsatz noch nicht
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            In der Abfrage gewusst, im Szenenfluss aber gehakt – hier hilft das Stichwort davor.
          </p>
          {cues.length ? (
            <ul className="mt-2 divide-y divide-border/60 border-y border-border/60">
              {cues.map((entry) => (
                <li key={entry.unitId}>
                  <button
                    type="button"
                    onClick={() => onFlow(entry.sceneId)}
                    className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{snippet(entry.unitId)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {sceneTitle(entry.sceneId)} · im Fluss üben
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Nichts Auffälliges.</p>
          )}
        </section>
      </main>
    </div>
  );
}
