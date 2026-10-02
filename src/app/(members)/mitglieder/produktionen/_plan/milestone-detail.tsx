"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { PlanMilestone } from "@/lib/planning/plan-service";
import { cn } from "@/lib/utils";

import { DeadlineBadge } from "@/components/production/deadline-badge";
import { DAY_FORMAT, SHORT_DAY_FORMAT, describeAnchor } from "./format";
import { HEALTH_BADGE, HEALTH_LABELS } from "@/components/production/deadline-health";

const KIND_LABELS: Record<PlanMilestone["kind"], string> = {
  milestone: "Meilenstein",
  deadline: "Frist",
  handover: "Abgabe",
  review: "Abnahme",
};

/** Inhalt von Panel (Desktop) und BottomSheet (mobil) für einen Meilenstein. */
export function MilestoneDetail({
  milestone,
  milestones,
  canManage,
  pending,
  onToggleDone,
  onEdit,
  onDelete,
  onSelect,
}: {
  milestone: PlanMilestone;
  milestones: PlanMilestone[];
  canManage: boolean;
  pending: boolean;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: (id: string) => void;
}) {
  const titles = new Map(milestones.map((entry) => [entry.id, entry.title]));
  const successors = milestones.filter((entry) =>
    entry.predecessors.some((dep) => dep.fromId === milestone.id),
  );
  const due = milestone.dueAt ? new Date(milestone.dueAt) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            HEALTH_BADGE[milestone.health],
          )}
        >
          {HEALTH_LABELS[milestone.health]}
        </span>
        <span className="text-muted-foreground">{KIND_LABELS[milestone.kind]}</span>
        {milestone.department ? (
          <span className="text-muted-foreground">· {milestone.department.name}</span>
        ) : null}
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Fällig</dt>
        <dd className="flex flex-wrap items-center gap-2">
          {due ? DAY_FORMAT.format(due) : "noch offen"}
          {due ? <DeadlineBadge dueAt={due} health={milestone.health} /> : null}
        </dd>
        <dt className="text-muted-foreground">Bezug</dt>
        <dd>{describeAnchor(milestone, titles)}</dd>
        {milestone.slackDays !== null && !milestone.doneAt ? (
          <>
            <dt className="text-muted-foreground">Puffer</dt>
            <dd className={cn(milestone.slackDays <= 0 && "font-medium text-destructive")}>
              {milestone.slackDays === 1 ? "1 Tag" : `${milestone.slackDays} Tage`}
            </dd>
          </>
        ) : null}
        {milestone.doneAt ? (
          <>
            <dt className="text-muted-foreground">Erledigt</dt>
            <dd>{DAY_FORMAT.format(new Date(milestone.doneAt))}</dd>
          </>
        ) : null}
      </dl>

      {milestone.endangeredBy.length ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Gefährdet durch {milestone.endangeredBy.map((id) => titles.get(id) ?? "?").join(", ")}
          {milestone.projectedAt
            ? ` – voraussichtlich ${DAY_FORMAT.format(new Date(milestone.projectedAt))}`
            : ""}
        </p>
      ) : null}

      {milestone.description ? (
        <p className="whitespace-pre-line text-sm">{milestone.description}</p>
      ) : null}

      {milestone.warnings.length ? (
        <div className="space-y-1 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
          {milestone.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <section className="space-y-2" aria-label="Karten">
        <div className="flex items-center gap-3">
          {milestone.tasksTotal ? (
            <ProgressRing value={milestone.tasksDone} max={milestone.tasksTotal} size={36} />
          ) : null}
          <p className="min-w-0 flex-1 text-sm font-medium">
            {milestone.tasksTotal
              ? `Karten · ${milestone.tasksDone} von ${milestone.tasksTotal} erledigt`
              : "Noch keine Karten"}
          </p>
          {milestone.department && milestone.canComplete ? (
            <Button asChild size="xs" variant="outline">
              <Link
                href={`/mitglieder/meine-gewerke/${encodeURIComponent(milestone.department.slug)}?ansicht=aufgaben&neu=1&meilenstein=${milestone.id}`}
              >
                + Karte
              </Link>
            </Button>
          ) : null}
        </div>
        {milestone.tasks.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {milestone.tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/mitglieder/meine-gewerke/${encodeURIComponent(task.departmentSlug)}?ansicht=aufgaben&karte=${task.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      task.done
                        ? "bg-success"
                        : task.late
                          ? "bg-warning"
                          : "bg-muted-foreground/40",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      task.done && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {task.late && task.dueAt
                      ? `nach Frist · ${SHORT_DAY_FORMAT.format(new Date(task.dueAt))}`
                      : task.departmentSlug !== milestone.department?.slug
                        ? task.departmentName
                        : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {milestone.predecessors.length || successors.length ? (
        <div className="space-y-1 text-sm">
          {milestone.predecessors.map((dep) => (
            <DependencyLink
              key={dep.fromId}
              label={`Braucht ${titles.get(dep.fromId) ?? "?"}`}
              hint={dep.lagDays ? `${dep.lagDays} T vorher fertig` : undefined}
              onClick={() => onSelect(dep.fromId)}
            />
          ))}
          {successors.map((entry) => (
            <DependencyLink
              key={entry.id}
              label={`Vor ${entry.title}`}
              onClick={() => onSelect(entry.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {milestone.canComplete ? (
          <Button
            size="sm"
            variant={milestone.doneAt ? "outline" : "primary"}
            onClick={onToggleDone}
            disabled={pending}
          >
            {milestone.doneAt ? "Wieder öffnen" : "Als erledigt markieren"}
          </Button>
        ) : null}
        {canManage ? (
          <>
            <Button size="sm" variant="outline" onClick={onEdit} disabled={pending}>
              Bearbeiten
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={pending}
            >
              Löschen
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DependencyLink({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
    >
      <span className="min-w-0 truncate">{label}</span>
      {hint ? <span className="shrink-0 text-xs text-muted-foreground">{hint}</span> : null}
    </button>
  );
}
