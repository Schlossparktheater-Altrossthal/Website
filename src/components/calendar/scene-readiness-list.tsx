"use client";

import { CheckIcon, PlusIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import {
  READINESS_LABEL,
  READINESS_ORDER,
  countReadiness,
  describeReadiness,
  type SceneReadiness,
  type SceneReadinessStatus,
} from "@/lib/calendar/scene-readiness";
import { cn } from "@/lib/utils";

const DOT: Record<SceneReadinessStatus, string> = {
  ready: "bg-success",
  alternate: "bg-info",
  limited: "bg-warning",
  missing: "bg-destructive",
};

const TEXT: Record<SceneReadinessStatus, string> = {
  ready: "text-success",
  alternate: "text-info",
  limited: "text-warning",
  missing: "text-destructive",
};

export function ReadinessDot({
  status,
  className,
}: {
  status: SceneReadinessStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", DOT[status], className)}
    />
  );
}

/** Kurzer Hinweistext einer Szene in Zustandsfarbe; leer, wenn sie vollständig ist. */
export function ReadinessHint({ entry }: { entry: SceneReadiness | undefined }) {
  if (!entry || entry.status === "ready") return null;
  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-xs", TEXT[entry.status])}>
      <ReadinessDot status={entry.status} />
      <span className="truncate">{describeReadiness(entry)}</span>
    </p>
  );
}

/** „6 vollständig · 2 mit Zweitbesetzung · 1 fehlt jemand“ */
export function ReadinessSummary({ entries }: { entries: readonly SceneReadiness[] }) {
  const counts = countReadiness(entries);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {READINESS_ORDER.filter((status) => counts[status]).map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5 tabular-nums">
          <ReadinessDot status={status} />
          {counts[status]} {READINESS_LABEL[status]}
        </span>
      ))}
    </span>
  );
}

/**
 * Szenen eines Tages nach Probbarkeit gruppiert. Mit `onAdd` bekommt jede noch nicht gewählte
 * Szene einen Knopf zum Hinzufügen.
 */
export function SceneReadinessList({
  entries,
  selectedIds,
  onAdd,
  onRemove,
  className,
}: {
  entries: readonly SceneReadiness[];
  selectedIds?: readonly string[];
  onAdd?: (sceneId: string) => void;
  /** Mit `onRemove` lässt sich eine gewählte Szene wieder abwählen (Auswahl statt Ablauf). */
  onRemove?: (sceneId: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {READINESS_ORDER.map((status) => {
        const group = entries.filter((entry) => entry.status === status);
        if (!group.length) return null;
        return (
          <section key={status} className="space-y-1">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ReadinessDot status={status} />
              {READINESS_LABEL[status]} ({group.length})
            </h4>
            <ul className="divide-y divide-border rounded-md border border-border">
              {group.map((entry) => {
                const selected = selectedIds?.includes(entry.sceneId);
                return (
                  <li key={entry.sceneId} className="flex min-h-11 items-center gap-2 px-3 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.label}</p>
                      {entry.status !== "ready" ? (
                        <p className="break-words text-xs text-muted-foreground">
                          {describeReadiness(entry)}
                        </p>
                      ) : null}
                    </div>
                    {onAdd ? (
                      selected && onRemove ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 w-9 shrink-0 p-0"
                          aria-label={`${entry.label} abwählen`}
                          aria-pressed
                          onClick={() => onRemove(entry.sceneId)}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </Button>
                      ) : selected ? (
                        <span className="shrink-0 text-xs text-muted-foreground">im Ablauf</span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 shrink-0 p-0"
                          aria-label={`${entry.label} hinzufügen`}
                          onClick={() => onAdd(entry.sceneId)}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
