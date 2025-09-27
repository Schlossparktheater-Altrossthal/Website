"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AllocationCandidate, AllocationRole, OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";

function computeAssignments(
  roles: AllocationRole[],
  capacities: Map<string, number>,
): Array<{
  role: AllocationRole;
  capacity: number;
  slots: Array<{
    slotId: string;
    candidate: AllocationCandidate | null;
    alternatives: AllocationCandidate[];
  }>;
}> {
  return roles.map((role) => {
    const capacity = Math.max(0, capacities.get(role.roleId) ?? role.capacity);
    const sorted = [...role.candidates].sort((a, b) => b.score - a.score);
    const slots = Array.from({ length: capacity || 1 }).map((_, index) => {
      const candidate = sorted[index] ?? null;
      const alternatives = sorted.filter((_, idx) => idx !== index).slice(0, 2);
      return {
        slotId: `${role.roleId}-${index + 1}`,
        candidate,
        alternatives,
      };
    });
    return { role, capacity, slots };
  });
}

type AllocationTabProps = {
  allocation: OnboardingDashboardData["allocation"];
};

export function AllocationTab({ allocation }: AllocationTabProps) {
  const [draftCapacities, setDraftCapacities] = useState(() =>
    new Map(allocation.roles.map((role) => [role.roleId, role.capacity])),
  );
  const [appliedCapacities, setAppliedCapacities] = useState(() =>
    new Map(allocation.roles.map((role) => [role.roleId, role.capacity])),
  );
  const [isRecalculating, startTransition] = useTransition();

  useEffect(() => {
    setDraftCapacities(new Map(allocation.roles.map((role) => [role.roleId, role.capacity])));
    setAppliedCapacities(new Map(allocation.roles.map((role) => [role.roleId, role.capacity])));
  }, [allocation.roles]);

  const assignments = useMemo(
    () => computeAssignments(allocation.roles, appliedCapacities),
    [allocation.roles, appliedCapacities],
  );

  const pendingChanges = useMemo(() => {
    return allocation.roles.some((role) => {
      const base = appliedCapacities.get(role.roleId) ?? role.capacity;
      const draft = draftCapacities.get(role.roleId) ?? role.capacity;
      return base !== draft;
    });
  }, [allocation.roles, appliedCapacities, draftCapacities]);

  const capacityChart = useMemo(
    () =>
      allocation.roles.map((role) => ({
        roleId: role.roleId,
        label: role.label,
        demand: role.demand,
        capacity: appliedCapacities.get(role.roleId) ?? role.capacity,
      })),
    [allocation.roles, appliedCapacities],
  );

  const handleApply = () => {
    startTransition(() => {
      setAppliedCapacities(new Map(draftCapacities));
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
              Kapazitäten vs. Nachfrage
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Aktuelle Zielgrößen pro Rolle im Verhältnis zu gemeldeten Präferenzen.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {capacityChart.map((entry, index) => {
              const overbooked = entry.demand > entry.capacity;
              return (
                <div key={entry.roleId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="text-muted-foreground">{entry.label}</span>
                    <span className={overbooked ? "text-rose-500" : "text-foreground/80"}>
                      {entry.capacity} / {entry.demand}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (entry.capacity / Math.max(entry.demand, 1)) * 100)}%` }}
                      transition={{ delay: index * 0.04, duration: 0.45, ease: "easeOut" }}
                      className={`h-full ${overbooked ? "bg-rose-400" : "bg-emerald-400"}`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
              Vorschlagsliste
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Top-Kandidat:innen je Slot inkl. Alternativen und Score.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignments.map((assignment) => (
              <div key={assignment.role.roleId} className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground/80">{assignment.role.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.capacity} Slots · Nachfrage {assignment.role.demand}
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs uppercase tracking-[0.14em]">
                    <UsersRound className="h-3.5 w-3.5" />
                    {assignment.role.domain === "acting" ? "Acting" : "Crew"}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {assignment.slots.map((slot, index) => (
                    <div
                      key={slot.slotId}
                      className="rounded-lg border border-border/30 bg-background/60 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground/85">
                          Slot {index + 1}
                        </span>
                        {slot.candidate ? (
                          <Badge variant="success" className="gap-1 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Score {slot.candidate.score.toFixed(2)} · Konfidenz {Math.round(slot.candidate.confidence * 100)}%
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">Noch unbesetzt</Badge>
                        )}
                      </div>
                      {slot.candidate ? (
                        <div className="mt-2 space-y-1 text-sm">
                          <p className="font-medium">{slot.candidate.name}</p>
                          <p className="text-muted-foreground">{slot.candidate.justification}</p>
                          <p className="text-xs text-muted-foreground">
                            Fokus {slot.candidate.focus ?? "–"} · Erfahrung {slot.candidate.experienceYears ?? 0} Jahre
                          </p>
                          {slot.candidate.interests.length ? (
                            <p className="text-xs text-muted-foreground">
                              Interessen: {slot.candidate.interests.slice(0, 3).join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Noch keine passende Zuordnung.</p>
                      )}
                      {slot.alternatives.length ? (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Alternativen
                          </p>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {slot.alternatives.map((candidate) => (
                              <li key={`${slot.slotId}-${candidate.userId}`}>
                                {candidate.name} · Score {candidate.score.toFixed(2)} · Konfidenz {Math.round(candidate.confidence * 100)}%
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
              Fairness-Ampeln
            </CardTitle>
            <p className="text-sm text-muted-foreground">Kontrolle über zentrale Ausgleichsmetriken.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {allocation.fairness.map((metric) => (
              <div key={metric.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground/80">{metric.label}</span>
                  <Badge
                    variant={
                      metric.status === "ok"
                        ? "success"
                        : metric.status === "warning"
                          ? "warning"
                          : "destructive"
                    }
                    className="uppercase tracking-[0.14em]"
                  >
                    {metric.value.toFixed(1)} (Ziel {metric.target})
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
              Kapazitäten anpassen
            </CardTitle>
            <p className="text-sm text-muted-foreground">Setze Slots neu und starte die Optimierung.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {allocation.roles.map((role) => {
                const max = Math.max(role.demand, role.capacity + 3);
                const current = draftCapacities.get(role.roleId) ?? role.capacity;
                return (
                  <div key={`slider-${role.roleId}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-muted-foreground">{role.label}</span>
                      <span className="text-foreground/80">{current} Slots</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, max)}
                      value={current}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setDraftCapacities((prev) => {
                          const next = new Map(prev);
                          next.set(role.roleId, value);
                          return next;
                        });
                      }}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted/40 accent-primary"
                    />
                  </div>
                );
              })}
            </div>
            <Button
              onClick={handleApply}
              disabled={!pendingChanges}
              className="w-full"
              variant="secondary"
              data-state={isRecalculating ? "loading" : undefined}
            >
              {isRecalculating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Neu berechnen …
                </>
              ) : (
                "Neu berechnen"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Konfliktliste</CardTitle>
            <p className="text-sm text-muted-foreground">Gleich hohe Scores & notwendige Entscheidungshilfen.</p>
          </CardHeader>
          <CardContent>
            {allocation.conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Konflikte erkannt – alle Prioritäten sind eindeutig.</p>
            ) : (
              <div className="space-y-3">
                {allocation.conflicts.map((conflict) => (
                  <div key={conflict.roleId} className="rounded-lg border border-border/40 bg-background/60 p-3">
                    <p className="text-sm font-semibold text-foreground/85">{conflict.label}</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {conflict.candidates.map((candidate) => (
                        <li key={candidate.userId}>
                          {candidate.name} · Score {candidate.score.toFixed(2)} · Kriterium: {candidate.tieBreaker}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
