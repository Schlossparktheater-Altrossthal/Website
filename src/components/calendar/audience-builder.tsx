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
import { ChoiceMenu } from "@/components/ui/choice-menu";
import {
  countAudienceRule,
  describeAudienceRule,
  PARTICIPATION_LEVEL_LABELS,
  resolveAudience,
  type AudienceBlock,
  type AudienceContext,
  type AudienceOverride,
  type AudienceRule,
  type ResolvedParticipant,
} from "@/lib/calendar/audience";
import type { DayAvailability } from "@/lib/calendar/day-availability";
import { describeLoad, weekdayShort, type PersonLoad } from "@/lib/calendar/week-load";
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

const NO_BLOCKS: readonly AudienceBlock[] = [];

export function AudienceBuilder({
  context,
  value,
  onChange,
  availability,
  conflicts = {},
  declined = {},
  hideSceneRules = false,
  blocks = NO_BLOCKS,
  weekLoad,
  dayKey,
}: {
  context: AudienceContext;
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
  /** Sperrliste am Termintag; ohne Angabe (Terminfinder) keine Verfügbarkeitsanzeige. */
  availability?: DayAvailability;
  /** Parallel zu einer anderen Probe eingeladen (Person → Titel). */
  conflicts?: Partial<Record<string, string>>;
  /** Abgesagt (Person → Begründung). */
  declined?: Record<string, string | null>;
  /** Szenen werden in einer eigenen Karte gepflegt (Proben). */
  hideSceneRules?: boolean;
  /** Gewerk-Bausteine des Termins, die ihr Gewerk einladen. */
  blocks?: readonly AudienceBlock[];
  /** Termine pro Person in der Woche des Termins (ohne diesen). */
  weekLoad?: Record<string, PersonLoad>;
  /** Termintag (yyyy-MM-dd) für „auch Sa“. */
  dayKey?: string;
}) {
  const [query, setQuery] = useState("");
  const resolved = useMemo(
    () => resolveAudience(value.rules, value.overrides, context, blocks),
    [value, context, blocks],
  );
  const invited = resolved.filter((entry) => !entry.excluded);
  const isOpen = (entry: ResolvedParticipant) => !(entry.userId in declined);
  const blockedCount = invited.filter(
    (entry) => isOpen(entry) && availability?.[entry.userId] === "blocked",
  ).length;
  const limitedCount = invited.filter(
    (entry) => isOpen(entry) && availability?.[entry.userId] === "limited",
  ).length;
  const conflictCount = invited.filter((entry) => conflicts[entry.userId]).length;
  const declinedCount = invited.filter((entry) => entry.userId in declined).length;
  const loadOf = (userId: string) =>
    weekLoad && dayKey ? describeLoad(weekLoad[userId], dayKey) : null;
  // Am Vor- oder Folgetag auch eingeladen: Kandidaten, um Proben auf einen Tag zu bündeln.
  const neighbours = invited.flatMap((entry) => {
    const load = loadOf(entry.userId);
    return load?.neighbors.length
      ? [`${entry.name.split(" ")[0]} (${load.neighbors.map(weekdayShort).join(" + ")})`]
      : [];
  });
  const heavyCount = invited.filter((entry) => loadOf(entry.userId)?.heavy).length;

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
  const groupOptions = [
    {
      type: "PRODUCTION_ALL" as const,
      label: context.hasProduction ? "Ganze Produktion" : "Alle Mitglieder",
    },
    ...(context.characters.length
      ? [{ type: "ALL_CAST" as const, label: "Alle Schauspieler" }]
      : []),
    ...(context.departments.length ? [{ type: "ALL_CREW" as const, label: "Alle Gewerke" }] : []),
  ].filter(
    (option) => !value.rules.some((rule) => sameRule(rule, { type: option.type, targetId: null })),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("de");
  const visible = normalizedQuery
    ? resolved.filter((entry) => entry.name.toLocaleLowerCase("de").includes(normalizedQuery))
    : resolved;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">{invited.length} eingeladen</span>
        {availability
          ? ` · ${invited.length - blockedCount - limitedCount - declinedCount} können`
          : ""}
        {limitedCount ? ` · ${limitedCount} eingeschränkt` : ""}
        {blockedCount ? ` · ${blockedCount} gesperrt` : ""}
        {declinedCount ? ` · ${declinedCount} abgesagt` : ""}
        {conflictCount ? ` · ${conflictCount} mit Terminüberschneidung` : ""}
        {heavyCount ? ` · ${heavyCount} diese Woche schon oft da` : ""}
      </p>
      {neighbours.length ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <span className="font-medium">Auch am Tag davor oder danach eingeladen:</span>{" "}
          {neighbours.join(", ")}. Lässt sich das auf einen Tag bündeln?
        </p>
      ) : null}

      <div className="space-y-2">
        <ChoiceMenu
          title="Einladen"
          align="start"
          trigger={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full sm:h-9 sm:w-auto"
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Einladen …
            </Button>
          }
          entries={[
            ...groupOptions.map((option) => ({
              id: option.type,
              label: option.label,
              onSelect: () => addRule({ type: option.type, targetId: null, level: "REQUIRED" }),
            })),
            {
              id: "DEPARTMENT",
              label: "Gewerk",
              separatorBefore: groupOptions.length > 0,
              items: unused("DEPARTMENT", context.departments).map((entry) => ({
                id: entry.id,
                label: entry.name,
              })),
              onSelect: (id?: string) => {
                if (id) addRule({ type: "DEPARTMENT", targetId: id, level: "REQUIRED" });
              },
            },
            {
              id: "CHARACTER",
              label: "Rolle",
              items: unused("CHARACTER", context.characters).map((entry) => ({
                id: entry.id,
                label: entry.name,
              })),
              onSelect: (id?: string) => {
                if (id) addRule({ type: "CHARACTER", targetId: id, level: "REQUIRED" });
              },
            },
            ...(!hideSceneRules
              ? [
                  {
                    id: "SCENE",
                    label: "Szene",
                    items: unused("SCENE", context.scenes).map((entry) => ({
                      id: entry.id,
                      label: entry.label,
                    })),
                    onSelect: (id?: string) => {
                      if (id) addRule({ type: "SCENE", targetId: id, level: "REQUIRED" });
                    },
                  },
                ]
              : []),
            {
              id: "PERSON",
              label: "Einzelne Person",
              keepOpen: true,
              items: context.members
                .filter((member) => !selectedIds.has(member.id))
                .map((member) => ({ id: member.id, label: member.name })),
              onSelect: (id?: string) => {
                if (id) addPerson(id);
              },
            },
          ]}
        />

        {value.rules.some((rule) => !hideSceneRules || rule.type !== "SCENE") ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {value.rules.map((rule, index) =>
              hideSceneRules && rule.type === "SCENE" ? null : (
                <li
                  key={`${rule.type}:${rule.targetId ?? ""}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 pl-3 pr-1"
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
              ),
            )}
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
          <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {visible.map((entry) => {
              const status: AvailabilityStatus | null = availability
                ? (availability[entry.userId] ?? "free")
                : null;
              const load = entry.excluded ? null : loadOf(entry.userId);
              return (
                <li
                  key={entry.userId}
                  className={cn(
                    "flex items-center gap-2 py-1 pl-3 pr-2",
                    entry.excluded && "bg-muted/50",
                  )}
                >
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1">
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
                      <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        {status && !entry.excluded ? (
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1",
                              AVAILABILITY_STATUS[status].text,
                            )}
                          >
                            <StatusDot status={status} />
                            {status === "free" ? "kann" : AVAILABILITY_STATUS[status].short}
                            <span aria-hidden className="text-muted-foreground">
                              ·
                            </span>
                          </span>
                        ) : null}
                        <span className="truncate">
                          {entry.excluded ? "ausgenommen · " : ""}
                          {entry.reasons.join(" · ")}
                        </span>
                      </span>
                      {entry.userId in declined && !entry.excluded ? (
                        <span className="block text-xs text-destructive">
                          Abgesagt{declined[entry.userId] ? `: „${declined[entry.userId]}“` : ""}
                        </span>
                      ) : null}
                      {load ? (
                        <span
                          className={cn(
                            "block text-xs",
                            load.heavy ? "text-warning" : "text-muted-foreground",
                          )}
                        >
                          {load.text}
                        </span>
                      ) : null}
                      {conflicts[entry.userId] && !entry.excluded ? (
                        <span className="block text-xs text-warning">
                          Zur selben Zeit eingeladen: {conflicts[entry.userId]}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {!entry.excluded ? (
                    <button
                      type="button"
                      onClick={() =>
                        setLevel(entry, entry.level === "REQUIRED" ? "OPTIONAL" : "REQUIRED")
                      }
                      aria-label={`Verbindlichkeit für ${entry.name}: ${PARTICIPATION_LEVEL_LABELS[entry.level]} – umschalten`}
                      title="Tippen zum Umschalten"
                      className={cn(
                        "min-h-9 shrink-0 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        entry.level === "REQUIRED"
                          ? "border-foreground/20 bg-foreground/10 text-foreground"
                          : "border-dashed border-border text-muted-foreground",
                      )}
                    >
                      {PARTICIPATION_LEVEL_LABELS[entry.level]}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {resolved.length
              ? "Niemand passt zur Suche."
              : "Noch niemand eingeladen. Über „Einladen …“ Gruppen, Gewerke, Rollen oder Personen wählen."}
          </div>
        )}
      </div>
    </div>
  );
}
