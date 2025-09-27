"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Filter, Shuffle, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MembersContentHeader,
  MembersContentLayout,
  MembersTopbar,
  MembersTopbarStatus,
  MembersTopbarTitle,
} from "@/components/members/members-app-shell";
import { cn } from "@/lib/utils";
import type { GlobalOnboardingStats } from "@/lib/onboarding-dashboard";
import type {
  AssignmentRequest,
  AssignmentSolution,
  ConflictEntry,
  FairnessSignal,
  TargetAssignment,
} from "@/lib/onboarding-assignment";

const numberFormat = new Intl.NumberFormat("de-DE");
const percentFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const DEFAULT_CAPACITIES: Record<string, number> = {
  acting_lead: 2,
  acting_medium: 4,
  acting_scout: 3,
  acting_statist: 6,
  crew_stage: 5,
  crew_light: 3,
  crew_sound: 3,
  crew_costume: 2,
  crew_props: 2,
};

const focusLabels: Record<string, string> = {
  acting: "Schauspiel",
  tech: "Technik",
  both: "Hybrid",
};

const fairnessStyles: Record<FairnessSignal["status"], string> = {
  good: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
  critical: "bg-red-50 text-red-800 border border-red-200",
};

type ConflictResponse = { conflicts: ConflictEntry[] };

type AssignmentResponse = { solution: AssignmentSolution };

type GlobalStatsResponse = { stats: GlobalOnboardingStats };

async function fetchGlobalStats(): Promise<GlobalOnboardingStats> {
  const response = await fetch("/api/stats/global", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Globale Onboarding-Kennzahlen konnten nicht geladen werden");
  }
  const payload = (await response.json()) as GlobalStatsResponse;
  return payload.stats;
}

async function postAssignmentSolve(config: AssignmentRequest): Promise<AssignmentSolution> {
  const response = await fetch("/api/assign/solve", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error("Zuteilung konnte nicht berechnet werden");
  }
  const payload = (await response.json()) as AssignmentResponse;
  return payload.solution;
}

async function fetchConflicts(solutionId: string): Promise<ConflictEntry[]> {
  const response = await fetch(`/api/assign/conflicts?solutionId=${solutionId}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Konfliktliste konnte nicht geladen werden");
  }
  const payload = (await response.json()) as ConflictResponse;
  return payload.conflicts;
}

function StatCard({ title, value, description }: { title: string; value: string; description?: string }) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
    </Card>
  );
}

function DistributionBar({
  items,
  emptyLabel,
}: {
  items: { key: string; label: string; count: number; share: number }[];
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? "Keine Daten"}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.label}</span>
            <span>
              {numberFormat.format(item.count)} · {percentFormat.format(item.share)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary/80"
              style={{ width: `${Math.min(100, Math.max(0, item.share))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapList({ combinations }: { combinations: { combination: string[]; count: number }[] }) {
  if (!combinations.length) {
    return <p className="text-sm text-muted-foreground">Keine häufigen Kombinationen vorhanden.</p>;
  }
  const max = combinations[0]?.count ?? 1;
  return (
    <div className="grid gap-2">
      {combinations.map((entry) => {
        const intensity = Math.min(1, entry.count / Math.max(1, max));
        return (
          <div
            key={entry.combination.join("|")}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
            style={{
              backgroundColor: `rgba(37, 99, 235, ${0.1 + intensity * 0.25})`,
              borderColor: `rgba(37, 99, 235, ${0.25 + intensity * 0.4})`,
            }}
          >
            <span className="font-medium text-foreground">{entry.combination.join(" + ")}</span>
            <span className="text-muted-foreground">{numberFormat.format(entry.count)}</span>
          </div>
        );
      })}
    </div>
  );
}

function WordCloud({ words }: { words: { name: string; count: number }[] }) {
  if (!words.length) {
    return <p className="text-sm text-muted-foreground">Keine Interessensdaten vorhanden.</p>;
  }
  const max = Math.max(...words.map((word) => word.count));
  return (
    <div className="flex flex-wrap gap-2">
      {words.map((word) => {
        const weight = max > 0 ? Math.max(1, (word.count / max) * 1.6) : 1;
        return (
          <span
            key={word.name}
            className="rounded-md bg-muted px-2 py-1 text-muted-foreground"
            style={{ fontSize: `${0.75 + weight}rem` }}
            title={`${word.count} Personen`}
          >
            {word.name}
          </span>
        );
      })}
    </div>
  );
}

function FairnessBadge({ signal }: { signal: FairnessSignal }) {
  return (
    <div className={cn("rounded-lg px-4 py-3", fairnessStyles[signal.status])}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {signal.status === "good" ? (
          <Users className="h-4 w-4" />
        ) : signal.status === "warning" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>{signal.summary}</span>
      </div>
      <div className="mt-2 grid gap-1 text-xs">
        {signal.metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between">
            <span className="text-muted-foreground">{metric.label}</span>
            <span>
              {percentFormat.format(metric.value * 100)}% · Ziel {percentFormat.format(metric.target * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentCard({
  target,
}: {
  target: TargetAssignment;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{target.label}</span>
          <Badge variant="outline">Kapazität {target.capacity}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Bedarf: {numberFormat.format(target.demand)} · Schnitt-Score {percentFormat.format(target.averageScore * 100)}%
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Zugewiesene Personen</h4>
          {target.assigned.length ? (
            <div className="mt-2 space-y-3">
              {target.assigned.map((candidate) => (
                <div key={candidate.profileId} className="rounded-md border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {candidate.name ?? candidate.email ?? "Unbekannt"}
                    </span>
                    <Badge variant="secondary">Score {percentFormat.format(candidate.score * 100)}%</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{focusLabels[candidate.focus] ?? candidate.focus}</span>
                    {candidate.age ? <span>{candidate.age} Jahre</span> : null}
                    {candidate.memberSinceYear ? <span>Mitglied seit {candidate.memberSinceYear}</span> : null}
                    <span>Dokumente: {candidate.documentStatus}</span>
                    <Badge variant="outline">Konfidenz {percentFormat.format(candidate.confidence * 100)}%</Badge>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    {candidate.reasons.slice(0, 3).map((reason, index) => (
                      <li key={`${candidate.profileId}-reason-${index}`}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Noch keine Zuteilung erfolgt.</p>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Alternativen</h4>
          {target.alternatives.length ? (
            <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
              {target.alternatives.map((candidate) => (
                <li key={candidate.profileId} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {candidate.name ?? candidate.email ?? "Unbekannt"}
                    </span>
                    <span>
                      {focusLabels[candidate.focus] ?? candidate.focus} · Score {percentFormat.format(candidate.score * 100)}%
                    </span>
                  </div>
                  <Badge variant="outline">Platz {candidate.rank}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Keine Alternativen notwendig.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConflictList({ conflicts }: { conflicts: ConflictEntry[] | undefined }) {
  if (!conflicts || conflicts.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Konflikte erkannt.</p>;
  }
  return (
    <div className="space-y-3">
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="rounded-md border p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-foreground">
            <span className="font-medium">
              {conflict.targetLabel} · {conflict.reason}
            </span>
            <Badge variant="outline">{conflict.domain === "acting" ? "Schauspiel" : "Crew"}</Badge>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {conflict.candidates.map((candidate) => (
              <li key={`${conflict.id}-${candidate.profileId}`}>
                {candidate.name ?? candidate.email ?? "Unbekannt"} · Score {percentFormat.format(candidate.score * 100)}%
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function MembersDashboard() {
  const [assignmentConfig, setAssignmentConfig] = useState<AssignmentRequest>({
    capacities: { ...DEFAULT_CAPACITIES },
    filters: {
      focuses: [],
      ageBuckets: [],
      backgrounds: [],
      documentStatuses: [],
    },
  });
  const [solution, setSolution] = useState<AssignmentSolution | null>(null);
  const [solutionId, setSolutionId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["onboarding-global-stats"],
    queryFn: fetchGlobalStats,
  });

  const assignmentMutation = useMutation({
    mutationFn: postAssignmentSolve,
    onSuccess: (nextSolution) => {
      setSolution(nextSolution);
      setSolutionId(nextSolution.id);
    },
  });
  const runAssignment = assignmentMutation.mutate;

  const {
    data: conflicts,
    refetch: refetchConflicts,
    isLoading: conflictsLoading,
    error: conflictsError,
  } = useQuery({
    queryKey: ["assignment-conflicts", solutionId],
    queryFn: () => fetchConflicts(solutionId!),
    enabled: Boolean(solutionId),
    initialData: solution?.conflicts,
  });

  useEffect(() => {
    if (!stats) return;
    const timer = setTimeout(() => {
      runAssignment(assignmentConfig);
    }, 300);
    return () => clearTimeout(timer);
  }, [assignmentConfig, stats, runAssignment]);

  useEffect(() => {
    if (solutionId) {
      void refetchConflicts();
    }
  }, [solutionId, refetchConflicts]);

  const focusFilters = stats?.filters.focuses ?? [];
  const ageBuckets = stats?.filters.ageBuckets ?? [];
  const documentStatuses = stats?.filters.documentStatuses ?? [];
  const backgrounds = stats?.filters.backgrounds ?? [];

  const handleCapacityChange = (code: string, value: number) => {
    setAssignmentConfig((prev) => ({
      ...prev,
      capacities: { ...prev.capacities, [code]: Math.max(0, Math.floor(value)) },
    }));
  };

  const toggleFilterValue = (key: keyof NonNullable<AssignmentRequest["filters"]>, value: string) => {
    setAssignmentConfig((prev) => {
      const existing = new Set(prev.filters?.[key] ?? []);
      if (existing.has(value)) {
        existing.delete(value);
      } else {
        existing.add(value);
      }
      return {
        ...prev,
        filters: {
          ...prev.filters,
          [key]: Array.from(existing),
        },
      };
    });
  };

  const handleBackgroundSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    setAssignmentConfig((prev) => ({
      ...prev,
      filters: { ...prev.filters, backgrounds: selected },
    }));
  };

  const resetCapacities = () => {
    setAssignmentConfig((prev) => ({ ...prev, capacities: { ...DEFAULT_CAPACITIES } }));
  };

  const resetFilters = () => {
    setAssignmentConfig((prev) => ({
      ...prev,
      filters: { focuses: [], ageBuckets: [], backgrounds: [], documentStatuses: [] },
    }));
  };

  return (
    <>
      <MembersContentLayout width="full" spacing="comfortable" gap="lg" />
      <MembersTopbar>
        <MembersTopbarTitle>Onboarding-Dashboard</MembersTopbarTitle>
        <MembersTopbarStatus>Überblick & Zuteilungsplanung</MembersTopbarStatus>
      </MembersTopbar>
      <MembersContentHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Analyse des Onboardings und automatisierte Vorschläge für Rollen- und Gewerkezuweisungen.
          </p>
          {stats ? (
            <p className="text-xs text-muted-foreground">
              Aktualisiert am {new Date(stats.generatedAt).toLocaleString("de-DE")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => assignmentMutation.mutate(assignmentConfig)}
            disabled={assignmentMutation.isPending}
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Neu optimieren
          </Button>
        </div>
      </MembersContentHeader>

      <div className="space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4" /> Globaler Überblick
          </div>
          {statsLoading ? (
            <p className="text-sm text-muted-foreground">Lade Kennzahlen …</p>
          ) : statsError ? (
            <p className="text-sm text-red-600">{(statsError as Error).message}</p>
          ) : stats ? (
            <div className="space-y-8">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  title="Teilnehmende gesamt"
                  value={numberFormat.format(stats.totals.participants)}
                  description="Summe aller abgeschlossenen Onboardings"
                />
                <StatCard
                  title="Neue Teilnehmer*innen (Woche)"
                  value={numberFormat.format(stats.totals.newThisWeek)}
                />
                <StatCard
                  title="Neue Teilnehmer*innen (Monat)"
                  value={numberFormat.format(stats.totals.newThisMonth)}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Altersstruktur</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Medianalter {stats.age.median ? `${stats.age.median} Jahre` : "unbekannt"}
                    </p>
                    <DistributionBar
                      items={stats.age.buckets.map((bucket) => ({
                        key: bucket.id,
                        label:
                          bucket.min === null
                            ? "Unter 18"
                            : bucket.max === null
                            ? "Über 40"
                            : `${bucket.min} – ${bucket.max}`,
                        count: bucket.count,
                        share: bucket.share,
                      }))}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Fokus & Geschlechter</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 md:grid-cols-2">
                    <DistributionBar
                      items={stats.focus.map((entry) => ({
                        key: entry.focus,
                        label: focusLabels[entry.focus] ?? entry.focus,
                        count: entry.count,
                        share: entry.share,
                      }))}
                    />
                    <DistributionBar
                      items={stats.genders.map((entry) => ({
                        key: entry.key,
                        label: entry.label,
                        count: entry.count,
                        share: entry.share,
                      }))}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Lagebild Hygiene</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-muted-foreground">
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                      Fotoeinverständnis: {percentFormat.format(stats.photoConsent.consentRate * 100)}% genehmigt
                    </div>
                    <p>
                      Pending: {numberFormat.format(stats.photoConsent.pending)}, Fehlend: {" "}
                      {numberFormat.format(stats.photoConsent.missing)}
                    </p>
                    <p>
                      Uploads vs. Skip: {numberFormat.format(stats.documents.uploaded)} Upload · {" "}
                      {numberFormat.format(stats.documents.skipped)} Skip · {numberFormat.format(stats.documents.pending)} offen
                    </p>
                    <p>
                      Abschlussquote: {percentFormat.format(stats.onboardingProgress.completionRate * 100)}% ({" "}
                      {numberFormat.format(stats.onboardingProgress.completed)} von {" "}
                      {numberFormat.format(stats.onboardingProgress.started)})
                    </p>
                    <div>
                      <p className="font-medium text-foreground">Abbrüche je Schritt</p>
                      <ul className="mt-1 space-y-1">
                        {stats.onboardingProgress.dropoffs.map((stage) => (
                          <li key={stage.stage}>
                            {stage.stage}: {numberFormat.format(stage.dropouts)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Ernährung & Allergien</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Top-Ernährungsstile</p>
                      <ul className="mt-2 space-y-1">
                        {stats.dietary.topFive.map((item) => (
                          <li key={item.style}>
                            {item.style} – {numberFormat.format(item.count)} ({percentFormat.format(item.share)}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Allergien nach Schweregrad</p>
                      <ul className="mt-2 space-y-1">
                        {stats.allergies.map((entry) => (
                          <li key={entry.level}>
                            {entry.level}: {numberFormat.format(entry.total)} Fälle
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Onboarding-Dokumente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-muted-foreground">
                    <p>
                      Uploads: {numberFormat.format(stats.documents.uploaded)} · Skip: {numberFormat.format(stats.documents.skipped)}
                    </p>
                    <p>Pending Uploads: {numberFormat.format(stats.documents.pending)}</p>
                    <p>Fehlende Einwilligungen: {numberFormat.format(stats.photoConsent.missing)}</p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="roles" className="w-full">
                <TabsList>
                  <TabsTrigger value="roles">Rollen & Gewerke</TabsTrigger>
                  <TabsTrigger value="interests">Interessen</TabsTrigger>
                </TabsList>
                <TabsContent value="roles" className="space-y-6 pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Präferenzabdeckung</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs text-muted-foreground">
                        <p>
                          Durchschnittliche normierte Anteile (Schauspiel): {stats.roles.averageNormalizedShare.acting}%
                        </p>
                        <p>
                          Durchschnittliche normierte Anteile (Crew): {stats.roles.averageNormalizedShare.crew}%
                        </p>
                        <p>
                          Präferenzen pro Person – Schauspiel: {stats.roles.averagePreferencesPerPerson.acting} · Crew: {" "}
                          {stats.roles.averagePreferencesPerPerson.crew}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Verteilung nach Rolle/Gewerk</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DistributionBar
                          items={stats.roles.preferencePresence.map((entry) => ({
                            key: `${entry.domain}-${entry.code}`,
                            label: `${entry.label} (${entry.domain === "acting" ? "Schauspiel" : "Crew"})`,
                            count: entry.respondents,
                            share: entry.share,
                          }))}
                        />
                      </CardContent>
                    </Card>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Kombinationen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <HeatmapList combinations={stats.roles.combinations} />
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="interests" className="space-y-6 pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 10 Interessen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {stats.interests.top.map((interest) => (
                          <li key={interest.name}>
                            {interest.name} – {numberFormat.format(interest.count)} Personen
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Wordcloud & Diversität</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <WordCloud words={stats.interests.wordcloud.slice(0, 60)} />
                      <p className="text-xs text-muted-foreground">
                        Shannon-Index {stats.interests.diversity.shannonIndex} · Normalisiert {" "}
                        {stats.interests.diversity.normalizedIndex} · {stats.interests.diversity.uniqueTags} Tags
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Co-Occurrence</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {stats.interests.cooccurrences.slice(0, 15).map((pair) => (
                          <li key={pair.pair.join("|")}>
                            {pair.pair.join(" + ")} – {numberFormat.format(pair.count)}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4" /> Zuteilung & Optimierung
          </div>
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Filter</CardTitle>
                <p className="text-xs text-muted-foreground">Steuerung der Optimierung über Drilldown-Parameter.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Filter zurücksetzen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <Filter className="h-4 w-4" /> Fokus
                </p>
                <div className="flex flex-wrap gap-2">
                  {focusFilters.map((entry) => {
                    const active = assignmentConfig.filters?.focuses?.includes(entry.focus) ?? false;
                    return (
                      <Button
                        key={entry.focus}
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleFilterValue("focuses", entry.focus)}
                      >
                        {focusLabels[entry.focus] ?? entry.focus}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Alter</p>
                <div className="flex flex-wrap gap-2">
                  {ageBuckets.map((bucket) => {
                    const active = assignmentConfig.filters?.ageBuckets?.includes(bucket.id) ?? false;
                    const label = bucket.min === null ? "Unter 18" : bucket.max === null ? "Über 40" : `${bucket.min}–${bucket.max}`;
                    return (
                      <Button
                        key={bucket.id}
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleFilterValue("ageBuckets", bucket.id)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Dokumentstatus</p>
                <div className="flex flex-wrap gap-2">
                  {documentStatuses.map((status) => {
                    const active = assignmentConfig.filters?.documentStatuses?.includes(status) ?? false;
                    return (
                      <Button
                        key={status}
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleFilterValue("documentStatuses", status)}
                      >
                        {status}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Hintergründe</p>
                <select
                  multiple
                  value={assignmentConfig.filters?.backgrounds ?? []}
                  onChange={handleBackgroundSelection}
                  className="h-24 w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none"
                >
                  {backgrounds.map((background) => (
                    <option key={background} value={background}>
                      {background}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Kapazitäten & Bedarf</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Feinjustierung pro Rolle/Gewerk, automatische Reoptimierung nach Anpassung.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetCapacities}>
                Kapazitäten zurücksetzen
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(assignmentConfig.capacities).map(([code, capacity]) => (
                  <div key={code} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between font-medium text-foreground">
                      <span>{code.replace(/_/g, " ")}</span>
                      <span>Kapazität</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={capacity}
                      onChange={(event) => handleCapacityChange(code, Number(event.target.value))}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {assignmentMutation.isPending ? (
            <p className="text-sm text-muted-foreground">Optimiere Zuteilung …</p>
          ) : assignmentMutation.isError ? (
            <p className="text-sm text-red-600">{(assignmentMutation.error as Error).message}</p>
          ) : null}

          {solution ? (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Bedarf vs. Angebot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-muted-foreground">
                    {solution.demandVsCapacity.map((entry) => (
                      <div key={entry.code} className="rounded-md border p-3">
                        <div className="flex items-center justify-between text-foreground">
                          <span className="font-medium">{entry.label}</span>
                          <Badge variant="outline">
                            {entry.assigned}/{entry.capacity}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span>Bedarf {numberFormat.format(entry.demand)}</span>
                          <span>Auslastung {percentFormat.format(entry.fillRate * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Fairness-Ampeln</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {solution.fairness.length ? (
                      solution.fairness.map((signal) => <FairnessBadge key={signal.dimension} signal={signal} />)
                    ) : (
                      <p className="text-sm text-muted-foreground">Keine Fairnesskennzahlen verfügbar.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {solution.targets.map((target) => (
                  <AssignmentCard key={target.code} target={target} />
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Konfliktliste</CardTitle>
                </CardHeader>
                <CardContent>
                  {conflictsLoading ? (
                    <p className="text-sm text-muted-foreground">Lade Konflikte …</p>
                  ) : conflictsError ? (
                    <p className="text-sm text-red-600">{(conflictsError as Error).message}</p>
                  ) : (
                    <ConflictList conflicts={conflicts} />
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
