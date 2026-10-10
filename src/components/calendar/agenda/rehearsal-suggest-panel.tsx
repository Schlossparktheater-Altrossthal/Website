"use client";

import { useMemo, useState } from "react";

import { MinusIcon, PlusIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ReadinessDot } from "@/components/calendar/scene-readiness-list";
import { formatDuration } from "@/lib/calendar/agenda";
import {
  optimizeOrder,
  pickScenes,
  rankScenes,
  waitByPerson,
  type SceneCandidate,
} from "@/lib/calendar/rehearsal-suggest";
import { READINESS_LABEL } from "@/lib/calendar/scene-readiness";
import { cn } from "@/lib/utils";

function initialSelection(
  candidates: readonly SceneCandidate[],
  existing: readonly string[],
  budget: number,
) {
  const ranked = rankScenes(candidates);
  const kept = candidates.filter((entry) => existing.includes(entry.sceneId));
  const used = kept.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const { picked } = pickScenes(
    ranked.filter((entry) => !existing.includes(entry.sceneId)),
    budget - used,
    kept.flatMap((entry) => entry.people),
  );
  return new Set([...existing, ...picked.map((entry) => entry.sceneId)]);
}

/**
 * Probe vorschlagen: Szenen nach Dringlichkeit zum Abhaken, vorangehakt bis der Zeitrahmen voll
 * ist. „Übernehmen“ sortiert sie mit möglichst wenig Wartezeit in den Ablauf.
 */
export function RehearsalSuggestPanel({
  open,
  onOpenChange,
  candidates,
  existingSceneIds,
  defaultBudget,
  names,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: readonly SceneCandidate[];
  existingSceneIds: readonly string[];
  /** Verfügbare Minuten für Szenen (Terminzeit minus übrige Punkte). */
  defaultBudget: number;
  names: ReadonlyMap<string, string>;
  /** Gewählte Szenen in wartezeitarmer Reihenfolge. */
  onApply: (sceneIds: string[]) => void;
}) {
  const [budget, setBudget] = useState(defaultBudget);
  const [checked, setChecked] = useState<Set<string>>(() =>
    initialSelection(candidates, existingSceneIds, defaultBudget),
  );

  const ranked = useMemo(() => {
    const scored = rankScenes(candidates);
    const scoredIds = new Set(scored.map((entry) => entry.sceneId));
    // Nicht probbare Szenen unten, ausgegraut.
    const missing = candidates
      .filter((entry) => !scoredIds.has(entry.sceneId))
      .map((entry) => ({ ...entry, urgency: 0, reasons: [] as string[] }));
    return [...scored, ...missing];
  }, [candidates]);

  const selected = useMemo(
    () =>
      optimizeOrder(
        ranked
          .filter((entry) => checked.has(entry.sceneId))
          .map((entry) => ({ ...entry, id: entry.sceneId })),
      ),
    [ranked, checked],
  );
  const used = selected.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const people = new Set(selected.flatMap((entry) => entry.people)).size;
  const longest = useMemo(() => {
    let best: { userId: string; minutes: number } | null = null;
    for (const [userId, minutes] of waitByPerson(selected)) {
      if (minutes > 0 && (!best || minutes > best.minutes)) best = { userId, minutes };
    }
    return best;
  }, [selected]);
  const over = used > budget;

  const reset = (nextBudget: number) => {
    setBudget(nextBudget);
    setChecked(initialSelection(candidates, existingSceneIds, nextBudget));
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Probe vorschlagen"
      description="Szenen nach Dringlichkeit; vorangehakt, was in den Zeitrahmen passt."
      showDescription
      footer={
        <div className="flex w-full items-center gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!selected.length}
            onClick={() => onApply(selected.map((entry) => entry.sceneId))}
          >
            {selected.length} Szenen übernehmen
          </Button>
        </div>
      }
    >
      <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-popover px-1 pb-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Zeit für Szenen</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-auto h-9 w-9"
            aria-label="15 Minuten weniger"
            onClick={() => reset(Math.max(15, budget - 15))}
          >
            <MinusIcon className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center font-semibold tabular-nums">
            {formatDuration(budget)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="15 Minuten mehr"
            onClick={() => reset(budget + 15)}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={budget}
          aria-valuenow={used}
          aria-label="Belegte Zeit"
        >
          <div
            className={cn("h-full rounded-full", over ? "bg-warning" : "bg-primary")}
            style={{ width: `${Math.min(100, (used / Math.max(budget, 1)) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          <span className={cn("font-medium", over ? "text-warning" : "text-foreground")}>
            {formatDuration(used)} von {formatDuration(budget)}
          </span>
          {" · "}
          {people} {people === 1 ? "Person" : "Leute"} nötig
          {longest
            ? ` · längste Wartezeit: ${names.get(longest.userId) ?? "jemand"} ${formatDuration(longest.minutes)}`
            : selected.length
              ? " · keine Wartezeiten"
              : ""}
        </p>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {ranked.map((entry) => {
          const disabled = entry.readiness === "missing" && !checked.has(entry.sceneId);
          return (
            <li key={entry.sceneId}>
              <label
                className={cn(
                  "flex min-h-12 cursor-pointer items-start gap-3 px-3 py-2",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={checked.has(entry.sceneId)}
                  disabled={disabled}
                  onCheckedChange={(value) =>
                    setChecked((current) => {
                      const next = new Set(current);
                      if (value === true) next.add(entry.sceneId);
                      else next.delete(entry.sceneId);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <ReadinessDot status={entry.readiness} />
                    <span className="truncate">{entry.label}</span>
                    <span className="ml-auto shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                      {formatDuration(entry.durationMinutes)}
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {entry.readiness === "missing"
                      ? READINESS_LABEL.missing
                      : [
                          `${entry.done}× geprobt`,
                          ...entry.reasons.filter((reason) => reason !== "noch nie geprobt"),
                        ]
                          .join(" · ")
                          .replace(/^0× geprobt/, "noch nie geprobt")}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
