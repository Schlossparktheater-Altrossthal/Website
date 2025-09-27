"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";

import { recalculateAllocationAction } from "./actions";

type AllocationTabProps = {
  onboardingId: string;
  allocation: OnboardingDashboardData["allocation"];
};

export function AllocationTab({ onboardingId, allocation }: AllocationTabProps) {
  const [draftCapacities, setDraftCapacities] = useState(() =>
    new Map(allocation.roles.map((role) => [role.roleId, role.capacity])),
  );
  const [appliedCapacities, setAppliedCapacities] = useState(() =>
    new Map(allocation.roles.map((role) => [role.roleId, role.capacity])),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecalculating, startTransition] = useTransition();
  const queryClient = useQueryClient();

  useEffect(() => {
    setDraftCapacities(new Map(allocation.roles.map((role) => [role.roleId, role.capacity])));
    setAppliedCapacities(new Map(allocation.roles.map((role) => [role.roleId, role.capacity])));
    setErrorMessage(null);
  }, [allocation.roles]);

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
    const overrides = Array.from(draftCapacities.entries()).map(([roleId, capacity]) => ({
      roleId,
      capacity,
    }));

    startTransition(() => {
      setErrorMessage(null);
      void (async () => {
        try {
          const dashboard = await recalculateAllocationAction({
            onboardingId,
            capacities: overrides,
          });
          queryClient.setQueryData(["onboarding-dashboard", onboardingId], dashboard);
          const nextCapacities = new Map(
            dashboard.allocation.roles.map((role) => [role.roleId, role.capacity] as const),
          );
          setAppliedCapacities(nextCapacities);
          setDraftCapacities(new Map(nextCapacities));
        } catch (error) {
          console.error("Failed to recompute allocation", error);
          setErrorMessage("Optimierung fehlgeschlagen. Bitte später erneut versuchen.");
        }
      })();
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Optimiert: {allocation.optimizer.totalAssignments} / {allocation.optimizer.totalSlots} Slots belegt
              </span>
              {allocation.optimizer.averageScore !== null ? (
                <span>Ø Score {allocation.optimizer.averageScore.toFixed(2)}</span>
              ) : null}
            </div>
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
            {allocation.roles.map((role) => {
              const capacity = appliedCapacities.get(role.roleId) ?? role.capacity;
              const assignedCount = role.slots.filter((slot) => slot.candidate).length;
              const unmatchedLabel =
                typeof role.unmatchedDemand === "number" && role.unmatchedDemand > 0
                  ? ` · Offene Plätze ${role.unmatchedDemand}`
                  : "";
              const assignmentSummary = role.slots.length
                ? ` · Belegt ${assignedCount}/${role.slots.length}`
                : "";

              return (
                <div
                  key={role.roleId}
                  className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground/80">{role.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {capacity} Slots · Nachfrage {role.demand}
                        {assignmentSummary}
                        {unmatchedLabel}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1 text-xs uppercase tracking-[0.14em]">
                      <UsersRound className="h-3.5 w-3.5" />
                      {role.domain === "acting" ? "Acting" : "Crew"}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {role.slots.length ? (
                      role.slots.map((slot, index) => {
                        const candidate = slot.candidate;
                        const displayScore = candidate
                          ? typeof candidate.adjustedScore === "number"
                            ? candidate.adjustedScore
                            : candidate.score
                          : null;
                        const confidence = candidate && typeof candidate.confidence === "number"
                          ? Math.round(candidate.confidence * 100)
                          : null;

                        return (
                          <div
                            key={slot.slotId}
                            className="rounded-lg border border-border/30 bg-background/60 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground/85">
                                Slot {index + 1}
                              </span>
                              {candidate ? (
                                <Badge variant="success" className="gap-1 text-xs">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {displayScore !== null ? `Score ${displayScore.toFixed(2)}` : "Score –"}
                                  {confidence !== null ? ` · Konfidenz ${confidence}%` : ""}
                                </Badge>
                              ) : (
                                <Badge variant="warning" className="text-xs">Noch unbesetzt</Badge>
                              )}
                            </div>
                            {candidate ? (
                              <div className="mt-2 space-y-1 text-sm">
                                <p className="font-medium">{candidate.name}</p>
                                <p className="text-muted-foreground">{candidate.justification}</p>
                                <p className="text-xs text-muted-foreground">
                                  Fokus {candidate.focus ?? "–"} · Erfahrung {candidate.experienceYears ?? 0} Jahre
                                </p>
                                {typeof slot.fairnessPenalty === "number" && slot.fairnessPenalty > 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    Fairness-Malus {slot.fairnessPenalty.toFixed(2)}
                                  </p>
                                ) : null}
                                {candidate.interests.length ? (
                                  <p className="text-xs text-muted-foreground">
                                    Interessen: {candidate.interests.slice(0, 3).join(", ")}
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
                                  {slot.alternatives.map((candidateAlt) => {
                                    const altScore =
                                      typeof candidateAlt.adjustedScore === "number"
                                        ? candidateAlt.adjustedScore
                                        : candidateAlt.score;
                                    const altConfidence =
                                      typeof candidateAlt.confidence === "number"
                                        ? Math.round(candidateAlt.confidence * 100)
                                        : null;
                                    const deltaLabel =
                                      candidateAlt.delta !== undefined
                                        ? ` · Δ ${Math.abs(candidateAlt.delta).toFixed(2)}`
                                        : "";
                                    return (
                                      <li key={`${slot.slotId}-${candidateAlt.userId}`}>
                                        {candidateAlt.name} · Score {altScore.toFixed(2)}
                                        {altConfidence !== null ? ` · Konfidenz ${altConfidence}%` : ""}
                                        {deltaLabel}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Keine Slots definiert – bitte Kapazitäten erhöhen, um Vorschläge zu erhalten.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
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
            {errorMessage ? (
              <p className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> {errorMessage}
              </p>
            ) : null}
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
                  <div key={`${conflict.roleId}-${conflict.slotIndex}`} className="rounded-lg border border-border/40 bg-background/60 p-3">
                    <p className="text-sm font-semibold text-foreground/85">
                      {conflict.label} · Slot {conflict.slotIndex + 1} · Δ {conflict.delta.toFixed(2)}
                    </p>
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
