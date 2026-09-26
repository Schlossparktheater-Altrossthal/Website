"use client";

import { useMemo, useState } from "react";
import type { ParticipationLevel } from "@prisma/client";

import { CloseIcon, PlusIcon } from "@/components/ui/action-icons";
import {
  AVAILABILITY_STATUS,
  StatusDot,
  type AvailabilityStatus,
} from "@/components/ui/availability-status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countAudienceRule,
  describeAudienceRule,
  PARTICIPATION_LEVEL_LABELS,
  resolveAudience,
  type AudienceContext,
  type AudienceOverride,
  type AudienceRule,
  type ResolvedParticipant,
} from "@/lib/calendar/audience";
import type { DayAvailability } from "@/lib/calendar/day-availability";
import { cn } from "@/lib/utils";

export type AudienceValue = { rules: AudienceRule[]; overrides: AudienceOverride[] };

const LEVEL_OPTIONS = (["REQUIRED", "OPTIONAL"] as const).map((value) => ({
  value,
  label: PARTICIPATION_LEVEL_LABELS[value],
}));

function sameRule(a: AudienceRule, b: Pick<AudienceRule, "type" | "targetId">) {
  return a.type === b.type && a.targetId === b.targetId;
}

/** Überschreibt die Handänderung einer Person; leere Einträge fallen weg. */
function withOverride(
  overrides: readonly AudienceOverride[],
  userId: string,
  patch: Partial<Omit<AudienceOverride, "userId">>,
) {
  const current = overrides.find((entry) => entry.userId === userId) ?? {
    userId,
    override: null,
    level: null,
  };
  const next = { ...current, ...patch };
  const rest = overrides.filter((entry) => entry.userId !== userId);
  return next.override || next.level ? [...rest, next] : rest;
}

function AddSelect({
  placeholder,
  options,
  onSelect,
}: {
  placeholder: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  if (!options.length) return null;
  return (
    <Select value="" onValueChange={onSelect}>
      <SelectTrigger className="h-11 w-full sm:h-9 sm:w-auto sm:min-w-36" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AudienceBuilder({
  context,
  value,
  onChange,
  availability,
  conflicts = {},
  declined = {},
}: {
  context: AudienceContext;
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
  /** Sperrliste am Termintag. */
  availability: DayAvailability;
  /** Parallel zu einer anderen Probe eingeladen (Person → Titel). */
  conflicts?: Partial<Record<string, string>>;
  /** Abgesagt (Person → Begründung). */
  declined?: Record<string, string | null>;
}) {
  const [query, setQuery] = useState("");
  const resolved = useMemo(
    () => resolveAudience(value.rules, value.overrides, context),
    [value, context],
  );
  const invited = resolved.filter((entry) => !entry.excluded);
  const isOpen = (entry: ResolvedParticipant) => !(entry.userId in declined);
  const blockedCount = invited.filter(
    (entry) => isOpen(entry) && availability[entry.userId] === "blocked",
  ).length;
  const limitedCount = invited.filter(
    (entry) => isOpen(entry) && availability[entry.userId] === "limited",
  ).length;
  const conflictCount = invited.filter((entry) => conflicts[entry.userId]).length;
  const declinedCount = invited.filter((entry) => entry.userId in declined).length;

  const addRule = (rule: AudienceRule) => {
    if (value.rules.some((entry) => sameRule(entry, rule))) return;
    onChange({ ...value, rules: [...value.rules, rule] });
  };
  const updateRule = (index: number, level: ParticipationLevel) =>
    onChange({
      ...value,
      rules: value.rules.map((rule, position) => (position === index ? { ...rule, level } : rule)),
    });
  const removeRule = (index: number) =>
    onChange({ ...value, rules: value.rules.filter((_, position) => position !== index) });

  const addPerson = (userId: string) => {
    const existing = resolved.find((entry) => entry.userId === userId);
    // Aus Regeln bereits dabei: nur eine Ausnahme aufheben.
    const override = existing?.ruleLevel ? null : "INCLUDED";
    onChange({ ...value, overrides: withOverride(value.overrides, userId, { override }) });
  };

  const toggle = (entry: ResolvedParticipant) => {
    let override: AudienceOverride["override"];
    if (entry.excluded) override = null;
    else if (entry.ruleLevel) override = "EXCLUDED";
    else override = null; // Von Hand hinzugefügt: wieder entfernen
    const patch = override === null && !entry.ruleLevel ? { override, level: null } : { override };
    onChange({ ...value, overrides: withOverride(value.overrides, entry.userId, patch) });
  };

  const setLevel = (entry: ResolvedParticipant, level: ParticipationLevel) =>
    onChange({
      ...value,
      overrides: withOverride(value.overrides, entry.userId, {
        level: level === entry.ruleLevel ? null : level,
      }),
    });

  const unused = <T extends { id: string }>(type: AudienceRule["type"], items: T[]) =>
    items.filter(
      (item) => !value.rules.some((rule) => sameRule(rule, { type, targetId: item.id })),
    );
  const selectedIds = new Set(invited.map((entry) => entry.userId));
  const normalizedQuery = query.trim().toLocaleLowerCase("de");
  const visible = normalizedQuery
    ? resolved.filter((entry) => entry.name.toLocaleLowerCase("de").includes(normalizedQuery))
    : resolved;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">{invited.length} eingeladen</span>
        {" · "}
        {invited.length - blockedCount - limitedCount - declinedCount} können
        {limitedCount ? ` · ${limitedCount} eingeschränkt` : ""}
        {blockedCount ? ` · ${blockedCount} gesperrt` : ""}
        {declinedCount ? ` · ${declinedCount} abgesagt` : ""}
        {conflictCount ? ` · ${conflictCount} mit Terminüberschneidung` : ""}
      </p>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            {
              type: "PRODUCTION_ALL" as const,
              label: context.hasProduction ? "Ganze Produktion" : "Alle Mitglieder",
              short: context.hasProduction ? "Produktion" : "Alle",
            },
            ...(context.characters.length
              ? [{ type: "ALL_CAST" as const, label: "Alle Schauspieler", short: "Schauspieler" }]
              : []),
            ...(context.departments.length
              ? [{ type: "ALL_CREW" as const, label: "Alle Gewerke", short: "Gewerke" }]
              : []),
          ]
            .filter(
              (option) =>
                !value.rules.some((rule) => sameRule(rule, { type: option.type, targetId: null })),
            )
            .map((option) => (
              <Button
                key={option.type}
                type="button"
                variant="outline"
                size="sm"
                className="h-11 justify-start px-3 sm:h-9"
                onClick={() => addRule({ type: option.type, targetId: null, level: "REQUIRED" })}
              >
                <PlusIcon className="h-4 w-4" />
                <span className="sm:hidden">{option.short}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </Button>
            ))}
          <AddSelect
            placeholder="+ Gewerk"
            options={unused("DEPARTMENT", context.departments).map((entry) => ({
              id: entry.id,
              label: entry.name,
            }))}
            onSelect={(id) => addRule({ type: "DEPARTMENT", targetId: id, level: "REQUIRED" })}
          />
          <AddSelect
            placeholder="+ Rolle"
            options={unused("CHARACTER", context.characters).map((entry) => ({
              id: entry.id,
              label: entry.name,
            }))}
            onSelect={(id) => addRule({ type: "CHARACTER", targetId: id, level: "REQUIRED" })}
          />
          <AddSelect
            placeholder="+ Szene"
            options={unused("SCENE", context.scenes).map((entry) => ({
              id: entry.id,
              label: entry.label,
            }))}
            onSelect={(id) => addRule({ type: "SCENE", targetId: id, level: "REQUIRED" })}
          />
          <AddSelect
            placeholder="+ Person"
            options={context.members
              .filter((member) => !selectedIds.has(member.id))
              .map((member) => ({ id: member.id, label: member.name }))}
            onSelect={addPerson}
          />
        </div>

        {value.rules.length ? (
          <ul className="space-y-2">
            {value.rules.map((rule, index) => (
              <li
                key={`${rule.type}:${rule.targetId ?? ""}`}
                className="flex flex-col gap-2 rounded-lg bg-muted p-3 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {describeAudienceRule(rule, context)}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({countAudienceRule(rule, context)})
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <SegmentedControl
                    value={rule.level}
                    onValueChange={(level) => updateRule(index, level)}
                    options={LEVEL_OPTIONS}
                    aria-label={`Verbindlichkeit für ${describeAudienceRule(rule, context)}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => removeRule(index)}
                    aria-label={`${describeAudienceRule(rule, context)} entfernen`}
                  >
                    <CloseIcon className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">Teilnehmer</h3>
          {resolved.length > 8 ? (
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name suchen"
              className="h-9 sm:max-w-56"
              aria-label="Teilnehmer suchen"
            />
          ) : null}
        </div>
        {visible.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {visible.map((entry) => {
              const status: AvailabilityStatus = availability[entry.userId] ?? "free";
              return (
                <li
                  key={entry.userId}
                  className={cn(
                    "flex flex-col gap-2 p-3 sm:flex-row sm:items-center",
                    entry.excluded && "bg-muted/50",
                  )}
                >
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={!entry.excluded}
                      onCheckedChange={() => toggle(entry)}
                      aria-label={`${entry.name} ${entry.excluded ? "wieder einladen" : "ausnehmen"}`}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          entry.excluded && "text-muted-foreground line-through",
                        )}
                      >
                        {entry.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.excluded ? "ausgenommen · " : ""}
                        {entry.reasons.join(" · ")}
                      </span>
                      {entry.userId in declined && !entry.excluded ? (
                        <span className="block text-xs text-destructive">
                          Abgesagt{declined[entry.userId] ? `: „${declined[entry.userId]}“` : ""}
                        </span>
                      ) : null}
                      {conflicts[entry.userId] && !entry.excluded ? (
                        <span className="block text-xs text-warning">
                          Zur selben Zeit eingeladen: {conflicts[entry.userId]}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <div className="flex items-center gap-3 pl-8 sm:pl-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs",
                        AVAILABILITY_STATUS[status].text,
                      )}
                    >
                      <StatusDot status={status} />
                      {status === "free" ? "kann" : AVAILABILITY_STATUS[status].short}
                    </span>
                    {!entry.excluded ? (
                      <SegmentedControl
                        value={entry.level}
                        onValueChange={(level) => setLevel(entry, level)}
                        options={LEVEL_OPTIONS}
                        aria-label={`Verbindlichkeit für ${entry.name}`}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {resolved.length
              ? "Niemand passt zur Suche."
              : "Noch niemand ausgewählt. Füge oben eine Gruppe, Rolle, Szene oder Person hinzu."}
          </div>
        )}
      </div>
    </div>
  );
}
