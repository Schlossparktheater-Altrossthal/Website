"use client";

import { CalendarRange } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile } from "@/components/ui/stat-tile";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { PlanMilestone, ProductionPlan } from "@/lib/planning/plan-service";
import {
  computeDueDates,
  diffDueDates,
  formatCountdown,
  fromDay,
  toDay,
} from "@/lib/planning/schedule";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";

import {
  deleteMilestoneAction,
  saveMilestoneAction,
  setMilestoneDoneAction,
  type MilestoneInput,
} from "../actions/plan";
import { PlanAgenda } from "./agenda";
import { DAY_FORMAT } from "./format";
import { MilestoneDetail } from "./milestone-detail";
import { MilestoneForm, type MilestoneDefaults } from "./milestone-form";
import { PlanCalendar } from "./plan-calendar";
import { TemplatesPanel, type PlanTemplateSummary } from "./templates-panel";
import { PlanGantt, type GanttHoliday, type TimelineMove } from "./gantt";

type View = "timeline" | "agenda" | "calendar";

function toInput(milestone: PlanMilestone, showId: string): MilestoneInput {
  return {
    id: milestone.id,
    showId,
    title: milestone.title,
    description: milestone.description,
    kind: milestone.kind,
    departmentId: milestone.department?.id ?? null,
    anchorType: milestone.anchorType,
    anchorMilestoneId: milestone.anchorMilestoneId,
    offsetDays: milestone.offsetDays,
    durationDays: milestone.durationDays,
    fixedDate: milestone.fixedDate ? milestone.fixedDate.slice(0, 10) : null,
    predecessors: milestone.predecessors,
    mirrorToCalendar: milestone.mirrored,
  };
}

function scheduleInput(milestones: PlanMilestone[]) {
  return milestones.map((milestone) => ({
    id: milestone.id,
    anchorType: milestone.anchorType,
    anchorMilestoneId: milestone.anchorMilestoneId,
    offsetDays: milestone.offsetDays,
    fixedDate: milestone.fixedDate ? new Date(milestone.fixedDate) : null,
  }));
}

/**
 * Tab „Plan“ (docs/Plan/projektplanung-plan.md): Kennzahlen, Zeitleiste ab `md`, mobil Agenda,
 * Details als Panel rechts (ab `lg`) bzw. BottomSheet.
 */
export function PlanView({
  plan,
  templates,
  templateName,
  holidays = [],
}: {
  plan: ProductionPlan;
  /** Schulferien und Feiertage als Tageszahlen für die Zeitleiste. */
  holidays?: GanttHoliday[];
  templates: PlanTemplateSummary[];
  /** Vorschlag für „Als Vorlage speichern“. */
  templateName: string;
}) {
  const [templateMode, setTemplateMode] = React.useState<"apply" | "save" | null>(null);
  const isTablet = useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [chosenView, setChosenView] = React.useState<View | null>(null);
  const view: View = chosenView ?? (isTablet ? "timeline" : "agenda");
  const [onlyOverdue, setOnlyOverdue] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<PlanMilestone | "new" | null>(null);
  const [newDefaults, setNewDefaults] = React.useState<MilestoneDefaults | undefined>();
  const [deleting, setDeleting] = React.useState<PlanMilestone | null>(null);
  const [confirmDone, setConfirmDone] = React.useState<PlanMilestone | null>(null);
  const [move, setMove] = React.useState<TimelineMove | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selected = plan.milestones.find((milestone) => milestone.id === selectedId) ?? null;
  const today = toDay(new Date(plan.today));
  const countdown = plan.premiereAt ? toDay(new Date(plan.premiereAt)) - today : null;
  const open = plan.milestones.filter((milestone) => !milestone.doneAt && milestone.dueAt);
  const soon = open.filter((milestone) => {
    const day = toDay(new Date(milestone.dueAt as string));
    return day >= today && day <= today + 14;
  }).length;
  const overdue = open.filter((milestone) => milestone.health === "overdue").length;

  const run = (action: () => Promise<ProductionActionResult>, onDone?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        onDone?.();
      } else {
        toast.error(result.error);
      }
    });

  const handleSelect = (id: string | null) => setSelectedId(id);

  const moveInput = (target: PlanMilestone, change: TimelineMove) => {
    const input = toInput(target, plan.showId);
    if (target.anchorType === "fixed" && target.fixedDate) {
      input.fixedDate = fromDay(toDay(new Date(target.fixedDate)) + change.deltaDays)
        .toISOString()
        .slice(0, 10);
    } else {
      input.offsetDays = target.offsetDays + change.deltaDays;
    }
    input.durationDays = Math.max(0, target.durationDays + change.durationDelta);
    return input;
  };

  // Nur die Dauer geändert: keine Folgeverschiebung, direkt speichern.
  const handleMove = (change: TimelineMove) => {
    const target = plan.milestones.find((milestone) => milestone.id === change.id);
    if (!target) return;
    if (change.deltaDays === 0) run(() => saveMilestoneAction(moveInput(target, change)));
    else setMove(change);
  };

  const handleLink = (fromId: string, toId: string) => {
    const target = plan.milestones.find((milestone) => milestone.id === toId);
    if (!target) return;
    if (target.predecessors.some((dep) => dep.fromId === fromId)) {
      toast.info("Diese Abhängigkeit gibt es schon.");
      return;
    }
    const input = toInput(target, plan.showId);
    input.predecessors = [...target.predecessors, { fromId, lagDays: 0 }];
    run(() => saveMilestoneAction(input));
  };

  const openNew = (defaults?: MilestoneDefaults) => {
    setNewDefaults(defaults);
    setEditing("new");
  };

  // Vorschau der Verschiebung durch Ziehen in der Zeitleiste.
  const moveTarget = move ? plan.milestones.find((milestone) => milestone.id === move.id) : null;
  const moveChanges = React.useMemo(() => {
    if (!move || !moveTarget) return [];
    const anchors = {
      premiereAt: plan.premiereAt ? new Date(plan.premiereAt) : null,
      finalRehearsalStart: plan.finalRehearsalStart ? new Date(plan.finalRehearsalStart) : null,
    };
    const before = computeDueDates(scheduleInput(plan.milestones), anchors);
    const moved = plan.milestones.map((milestone) =>
      milestone.id !== move.id
        ? milestone
        : milestone.anchorType === "fixed" && milestone.fixedDate
          ? {
              ...milestone,
              fixedDate: fromDay(
                toDay(new Date(milestone.fixedDate)) + move.deltaDays,
              ).toISOString(),
            }
          : { ...milestone, offsetDays: milestone.offsetDays + move.deltaDays },
    );
    try {
      return diffDueDates(before, computeDueDates(scheduleInput(moved), anchors));
    } catch (error) {
      console.error("PlanView move preview", error);
      return [];
    }
  }, [move, moveTarget, plan]);
  const titles = new Map(plan.milestones.map((milestone) => [milestone.id, milestone.title]));

  const confirmMove = () => {
    if (!move || !moveTarget) return;
    run(
      () => saveMilestoneAction(moveInput(moveTarget, move)),
      () => setMove(null),
    );
  };

  const detail = selected ? (
    <MilestoneDetail
      milestone={selected}
      milestones={plan.milestones}
      canManage={plan.canManage}
      pending={pending}
      onSelect={handleSelect}
      onToggleDone={() => {
        const open = selected.tasksTotal - selected.tasksDone;
        // Offene Karten: erst nachfragen, statt stillschweigend abzuhaken.
        if (!selected.doneAt && open > 0) setConfirmDone(selected);
        else run(() => setMilestoneDoneAction(selected.id, !selected.doneAt));
      }}
      onEdit={() => setEditing(selected)}
      onDelete={() => setDeleting(selected)}
    />
  ) : null;

  const viewOptions: { value: View; label: string }[] = isTablet
    ? [
        { value: "timeline", label: "Zeitleiste" },
        { value: "agenda", label: "Agenda" },
        { value: "calendar", label: "Kalender" },
      ]
    : [
        { value: "agenda", label: "Agenda" },
        { value: "calendar", label: "Kalender" },
      ];
  const effectiveView: View = !isTablet && view === "timeline" ? "agenda" : view;

  if (plan.milestones.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarRange className="h-6 w-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="font-medium">Noch kein Plan</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Meilensteine und Fristen bis zur Premiere – am schnellsten mit einer Vorlage.
            </p>
          </div>
          {plan.canManage ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setTemplateMode("apply")}>Vorlage übernehmen</Button>
              <Button variant="outline" onClick={() => openNew()}>
                Ersten Meilenstein anlegen
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Die Leitung legt den Plan an.</p>
          )}
          {!plan.premiereAt && plan.canManage ? (
            <p className="text-xs text-muted-foreground">
              Tipp: Erst die Premiere unter „Bearbeiten“ eintragen, dann rechnen sich die Fristen
              von selbst.
            </p>
          ) : null}
        </div>
        {renderForm()}
        {renderTemplates()}
      </div>
    );
  }

  function renderTemplates() {
    return templateMode ? (
      <TemplatesPanel
        mode={templateMode}
        open
        onOpenChange={(value) => !value && setTemplateMode(null)}
        showId={plan.showId}
        defaultName={templateName}
        templates={templates}
      />
    ) : null;
  }

  function renderForm() {
    return (
      <ResponsivePanel
        open={editing !== null}
        onOpenChange={(value) => !value && setEditing(null)}
        title={editing === "new" ? "Neuer Meilenstein" : "Meilenstein bearbeiten"}
        description="Titel, Bezug und Abhängigkeiten des Meilensteins"
      >
        {editing !== null ? (
          <MilestoneForm
            key={editing === "new" ? "new" : editing.id}
            plan={plan}
            milestone={editing === "new" ? null : editing}
            defaults={editing === "new" ? newDefaults : undefined}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) =>
              run(
                () => saveMilestoneAction(input),
                () => setEditing(null),
              )
            }
          />
        ) : null}
      </ResponsivePanel>
    );
  }

  return (
    <div className="space-y-4">
      {plan.cycleError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {plan.cycleError}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile
          label="bis Premiere"
          value={formatCountdown(countdown) ?? "–"}
          hint={plan.premiereAt ? DAY_FORMAT.format(new Date(plan.premiereAt)) : "noch offen"}
          tone="primary"
        />
        <StatTile label="Fristen in 14 Tagen" value={soon} tone={soon ? "warning" : "neutral"} />
        <button
          type="button"
          onClick={() => {
            setOnlyOverdue((value) => !value);
            if (effectiveView !== "agenda") setChosenView("agenda");
          }}
          className="min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-pressed={onlyOverdue}
        >
          <StatTile
            label="überfällig"
            value={overdue}
            tone={overdue ? "destructive" : "neutral"}
            hint={onlyOverdue ? "Filter aktiv" : overdue ? "antippen zum Filtern" : undefined}
            className="h-full"
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={effectiveView}
          onValueChange={(value) => {
            setChosenView(value);
            if (value !== "agenda") setOnlyOverdue(false);
          }}
          options={viewOptions}
          aria-label="Ansicht"
        />
        {plan.canManage ? (
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => openNew()}>+ Meilenstein</Button>
            <ActionDropdownMenu
              label="Weitere Aktionen"
              items={[{ label: "Als Vorlage speichern", onSelect: () => setTemplateMode("save") }]}
            />
          </div>
        ) : null}
      </div>

      <div
        className={
          isDesktop && selected
            ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
            : undefined
        }
      >
        <div className="min-w-0">
          {effectiveView === "timeline" ? (
            <PlanGantt
              plan={plan}
              holidays={holidays}
              selectedId={selectedId}
              onSelect={handleSelect}
              onMove={plan.canManage ? handleMove : undefined}
              onCreate={plan.canManage ? openNew : undefined}
              onLink={plan.canManage ? handleLink : undefined}
            />
          ) : effectiveView === "calendar" ? (
            <PlanCalendar plan={plan} onSelect={handleSelect} />
          ) : (
            <PlanAgenda
              milestones={plan.milestones}
              rehearsals={plan.rehearsals}
              today={plan.today}
              onlyOverdue={onlyOverdue}
              onSelect={handleSelect}
            />
          )}
        </div>
        {isDesktop && selected ? (
          <aside className="space-y-3 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 break-words text-base font-semibold">{selected.title}</h2>
              <Button variant="ghost" size="xs" onClick={() => setSelectedId(null)}>
                Schließen
              </Button>
            </div>
            {detail}
          </aside>
        ) : null}
      </div>

      {!isDesktop ? (
        <BottomSheet
          open={Boolean(selected)}
          onOpenChange={(value) => !value && setSelectedId(null)}
          title={selected?.title ?? ""}
          description="Details zum Meilenstein"
        >
          {detail}
        </BottomSheet>
      ) : null}

      {renderForm()}
      {renderTemplates()}

      <ResponsivePanel
        open={Boolean(move)}
        onOpenChange={(value) => !value && setMove(null)}
        title="Verschieben?"
        description="Vorschau der Folgeverschiebungen"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMove(null)} disabled={pending}>
              Abbrechen
            </Button>
            <Button onClick={confirmMove} disabled={pending}>
              Übernehmen
            </Button>
          </div>
        }
      >
        <ul className="space-y-1 text-sm">
          {moveChanges.map((change) => (
            <li key={change.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{titles.get(change.id)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {change.to ? DAY_FORMAT.format(change.to) : "–"}
                {change.shiftDays
                  ? ` (${change.shiftDays > 0 ? "+" : ""}${change.shiftDays} T)`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      </ResponsivePanel>

      <ConfirmDialog
        open={Boolean(confirmDone)}
        onOpenChange={(value) => !value && setConfirmDone(null)}
        title="Trotzdem erledigt?"
        description={
          confirmDone
            ? `${confirmDone.tasksTotal - confirmDone.tasksDone} ${
                confirmDone.tasksTotal - confirmDone.tasksDone === 1 ? "Karte ist" : "Karten sind"
              } noch offen. Die Karten bleiben im Board offen.`
            : ""
        }
        confirmLabel="Als erledigt markieren"
        cancelLabel="Abbrechen"
        variant="default"
        onCancel={() => setConfirmDone(null)}
        onConfirm={() => {
          const target = confirmDone;
          if (!target) return;
          run(
            () => setMilestoneDoneAction(target.id, true),
            () => setConfirmDone(null),
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        title="Meilenstein löschen?"
        description={`„${deleting?.title ?? ""}“ wird mit seinen Abhängigkeiten entfernt. Verknüpfte Karten bleiben erhalten.`}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          if (!target) return;
          run(
            () => deleteMilestoneAction(target.id),
            () => {
              setDeleting(null);
              setSelectedId(null);
            },
          );
        }}
      />
    </div>
  );
}
