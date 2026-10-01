"use client";

import * as React from "react";
import type { MilestoneAnchor, MilestoneKind } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { XIcon } from "@/components/ui/action-icons";
import type { PlanMilestone, ProductionPlan } from "@/lib/planning/plan-service";
import { computeDueDates } from "@/lib/planning/schedule";

import type { MilestoneInput } from "../actions/plan";
import { DAY_FORMAT, toDateInput } from "./format";

const NONE = "__none";

const KIND_OPTIONS: { value: MilestoneKind; label: string }[] = [
  { value: "milestone", label: "Meilenstein" },
  { value: "deadline", label: "Frist" },
  { value: "handover", label: "Abgabe" },
  { value: "review", label: "Abnahme / Bauprobe" },
];

const ANCHOR_OPTIONS: { value: MilestoneAnchor; label: string }[] = [
  { value: "premiere", label: "Premiere" },
  { value: "finalRehearsalStart", label: "Beginn Endprobenwoche" },
  { value: "milestone", label: "anderer Meilenstein" },
  { value: "fixed", label: "festes Datum" },
];

type FormState = {
  title: string;
  description: string;
  kind: MilestoneKind;
  departmentId: string;
  anchorType: MilestoneAnchor;
  anchorMilestoneId: string;
  days: number;
  direction: "before" | "after";
  fixedDate: string;
  predecessors: { fromId: string; lagDays: number }[];
};

function initialState(milestone: PlanMilestone | null): FormState {
  return {
    title: milestone?.title ?? "",
    description: milestone?.description ?? "",
    kind: milestone?.kind ?? "deadline",
    departmentId: milestone?.department?.id ?? NONE,
    anchorType: milestone?.anchorType ?? "premiere",
    anchorMilestoneId: milestone?.anchorMilestoneId ?? NONE,
    days: Math.abs(milestone?.offsetDays ?? 14),
    direction: (milestone?.offsetDays ?? -1) > 0 ? "after" : "before",
    fixedDate: toDateInput(milestone?.fixedDate ?? milestone?.dueAt ?? null),
    predecessors: milestone?.predecessors ?? [],
  };
}

/** Formular „+ Meilenstein“ / „Bearbeiten“: Bezug + Tage davor/danach, Datum live berechnet. */
export function MilestoneForm({
  plan,
  milestone,
  pending,
  onSubmit,
  onCancel,
}: {
  plan: ProductionPlan;
  milestone: PlanMilestone | null;
  pending: boolean;
  onSubmit: (input: MilestoneInput) => void;
  onCancel: () => void;
}) {
  const [state, setState] = React.useState(() => initialState(milestone));
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const others = plan.milestones.filter((entry) => entry.id !== milestone?.id);
  const offsetDays = state.direction === "before" ? -state.days : state.days;
  const selfId = milestone?.id ?? "__new__";

  const preview = React.useMemo(() => {
    const items = [
      ...others.map((entry) => ({
        id: entry.id,
        anchorType: entry.anchorType,
        anchorMilestoneId: entry.anchorMilestoneId,
        offsetDays: entry.offsetDays,
        fixedDate: entry.fixedDate ? new Date(entry.fixedDate) : null,
      })),
      {
        id: selfId,
        anchorType: state.anchorType,
        anchorMilestoneId: state.anchorMilestoneId === NONE ? null : state.anchorMilestoneId,
        offsetDays,
        fixedDate: state.fixedDate ? new Date(`${state.fixedDate}T00:00:00.000Z`) : null,
      },
    ];
    try {
      return computeDueDates(items, {
        premiereAt: plan.premiereAt ? new Date(plan.premiereAt) : null,
        finalRehearsalStart: plan.finalRehearsalStart ? new Date(plan.finalRehearsalStart) : null,
      }).get(selfId);
    } catch (error) {
      console.warn("MilestoneForm preview", error);
      return undefined;
    }
  }, [others, plan.finalRehearsalStart, plan.premiereAt, selfId, state, offsetDays]);

  const anchorMissing =
    (state.anchorType === "premiere" && !plan.premiereAt) ||
    (state.anchorType === "finalRehearsalStart" && !plan.finalRehearsalStart);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      id: milestone?.id,
      showId: plan.showId,
      title: state.title,
      description: state.description || null,
      kind: state.kind,
      departmentId: state.departmentId === NONE ? null : state.departmentId,
      anchorType: state.anchorType,
      anchorMilestoneId: state.anchorMilestoneId === NONE ? null : state.anchorMilestoneId,
      offsetDays,
      fixedDate: state.anchorType === "fixed" ? state.fixedDate || null : null,
      predecessors: state.predecessors.filter((dep) => dep.fromId !== NONE),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="milestone-title">Titel</Label>
        <Input
          id="milestone-title"
          value={state.title}
          onChange={(event) => update("title", event.target.value)}
          placeholder="z. B. Bauabgabe Bühne"
          required
          maxLength={160}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Art</Label>
          <Select
            value={state.kind}
            onValueChange={(value) => update("kind", value as MilestoneKind)}
          >
            <SelectTrigger aria-label="Art">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Gewerk</Label>
          <Select
            value={state.departmentId}
            onValueChange={(value) => update("departmentId", value)}
          >
            <SelectTrigger aria-label="Gewerk">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Ganze Produktion</SelectItem>
              {plan.departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Bezug</legend>
        <Select
          value={state.anchorType}
          onValueChange={(value) => update("anchorType", value as MilestoneAnchor)}
        >
          <SelectTrigger aria-label="Bezug">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANCHOR_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.value === "milestone" && others.length === 0}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {state.anchorType === "milestone" ? (
          <Select
            value={state.anchorMilestoneId}
            onValueChange={(value) => update("anchorMilestoneId", value)}
          >
            <SelectTrigger aria-label="Bezugs-Meilenstein">
              <SelectValue placeholder="Meilenstein wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Meilenstein wählen
              </SelectItem>
              {others.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {state.anchorType === "fixed" ? (
          <DateInput
            aria-label="Datum"
            value={state.fixedDate}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              update("fixedDate", event.target.value)
            }
            required
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              aria-label="Tage"
              className="w-24"
              value={state.days}
              onChange={(event) => update("days", Math.max(0, Number(event.target.value) || 0))}
            />
            <span className="text-sm text-muted-foreground">Tage</span>
            <SegmentedControl
              size="sm"
              value={state.direction}
              onValueChange={(value) => update("direction", value)}
              options={[
                { value: "before", label: "davor" },
                { value: "after", label: "danach" },
              ]}
              aria-label="Richtung"
            />
          </div>
        )}

        <p className="text-sm">
          {anchorMissing ? (
            <span className="text-muted-foreground">
              Datum erscheint, sobald{" "}
              {state.anchorType === "premiere" ? "die Premiere" : "die Endprobenwoche"} eingetragen
              ist.
            </span>
          ) : preview ? (
            <>
              Fällig am <span className="font-semibold">{DAY_FORMAT.format(preview)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Noch kein Datum.</span>
          )}
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Muss fertig sein nach …</legend>
        {state.predecessors.map((dep, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Select
              value={dep.fromId}
              onValueChange={(value) =>
                update(
                  "predecessors",
                  state.predecessors.map((entry, i) =>
                    i === index ? { ...entry, fromId: value } : entry,
                  ),
                )
              }
            >
              <SelectTrigger aria-label="Vorgänger" className="min-w-0 flex-1">
                <SelectValue placeholder="Meilenstein wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Meilenstein wählen
                </SelectItem>
                {others.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              max={365}
              aria-label="Vorlauf in Tagen"
              className="w-20"
              value={dep.lagDays}
              onChange={(event) =>
                update(
                  "predecessors",
                  state.predecessors.map((entry, i) =>
                    i === index
                      ? { ...entry, lagDays: Math.max(0, Number(event.target.value) || 0) }
                      : entry,
                  ),
                )
              }
            />
            <span className="text-xs text-muted-foreground">T Vorlauf</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Abhängigkeit entfernen"
              onClick={() =>
                update(
                  "predecessors",
                  state.predecessors.filter((_, i) => i !== index),
                )
              }
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {others.length ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() =>
              update("predecessors", [...state.predecessors, { fromId: NONE, lagDays: 0 }])
            }
          >
            + Abhängigkeit
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Abhängigkeiten gibt es ab dem zweiten Meilenstein.
          </p>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="milestone-description">Notiz</Label>
        <Textarea
          id="milestone-description"
          rows={3}
          value={state.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={pending || !state.title.trim()}>
          {milestone ? "Speichern" : "Anlegen"}
        </Button>
      </div>
    </form>
  );
}
