"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";
import { RoleSpiderChart } from "./role-spider-chart";

const domainLabels: Record<"acting" | "crew", string> = {
  acting: "Acting & Rollengrößen",
  crew: "Gewerke & Crew",
};

const focusLabel: Record<"acting" | "tech" | "both", string> = {
  acting: "Fokus Acting",
  tech: "Fokus Technik",
  both: "Fokus Acting + Crew",
};

const focusVariant: Record<"acting" | "tech" | "both", "success" | "warning" | "info"> = {
  acting: "success",
  tech: "warning",
  both: "info",
};

const numberFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const scoreFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type RankingTabProps = {
  ranking: OnboardingDashboardData["ranking"];
};

type Domain = "acting" | "crew";

type CandidatePreference = {
  roleId: string;
  label: string;
  share: number;
  rank: number;
};

type CandidateAggregate = {
  userId: string;
  name: string;
  email: string | null;
  focus: "acting" | "tech" | "both" | null;
  score: number;
  confidence: number;
  experienceYears: number | null;
  interests: string[];
  background: string | null;
  notes: string | null;
  bestRank: number | null;
  preferences: Record<Domain, CandidatePreference[]>;
};

function PreferenceColumn({
  domain,
  preferences,
  isActive,
}: {
  domain: Domain;
  preferences: CandidatePreference[];
  isActive: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-sm transition-colors ${
        isActive ? "border-primary/60 bg-primary/5" : "border-border/60 bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{domain === "acting" ? "Acting" : "Gewerk"}</span>
        {preferences.length > 0 && (
          <span>{percentageFormatter.format(preferences[0].share * 100)}%</span>
        )}
      </div>
      {preferences.length === 0 ? (
        <p className="mt-4 text-[11px] text-muted-foreground/80">
          Keine Präferenzen vorhanden.
        </p>
      ) : (
        <>
          <ol className="mt-3 space-y-1.5">
            {preferences.slice(0, 3).map((pref, index) => (
              <li
                key={`${domain}-${pref.roleId}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-2.5 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      index === 0 ? "bg-primary/15 text-primary" : "bg-muted text-foreground/80"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-foreground">{pref.label}</span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {percentageFormatter.format(pref.share * 100)}%
                </span>
              </li>
            ))}
          </ol>
          {preferences.length > 3 && (
            <p className="mt-2 text-[10px] text-muted-foreground/80">
              +{preferences.length - 3} weitere Präferenzen
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CandidateCard({ candidate, activeDomain }: { candidate: CandidateAggregate; activeDomain: Domain }) {
  const experienceLabel =
    candidate.experienceYears === null
      ? null
      : candidate.experienceYears === 0
        ? "Neu im Bereich"
        : `${candidate.experienceYears} Jahre Erfahrung`;
  const securityLabel = `${numberFormatter.format(Math.round(candidate.confidence * 100))}% Sicherheit`;

  return (
    <Card className="min-w-[320px] max-w-[360px] border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {candidate.bestRank !== null && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  #{candidate.bestRank}
                </span>
              )}
              <CardTitle className="truncate text-base font-semibold text-foreground">
                {candidate.name}
              </CardTitle>
            </div>
            {candidate.email && (
              <p className="mt-1 truncate text-xs text-muted-foreground">{candidate.email}</p>
            )}
          </div>
          {candidate.focus && (
            <Badge variant={focusVariant[candidate.focus]} size="sm" className="shrink-0">
              {focusLabel[candidate.focus]}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {experienceLabel && (
            <span className="rounded-full bg-muted/60 px-2 py-0.5 font-medium text-foreground/80">
              {experienceLabel}
            </span>
          )}
          <span className="rounded-full bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
            Score {scoreFormatter.format(candidate.score)}
          </span>
          <span className="rounded-full bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
            {securityLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <PreferenceColumn
            domain="acting"
            preferences={candidate.preferences.acting}
            isActive={activeDomain === "acting"}
          />
          <PreferenceColumn
            domain="crew"
            preferences={candidate.preferences.crew}
            isActive={activeDomain === "crew"}
          />
        </div>
        {candidate.interests.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidate.interests.map((interest) => (
                <Badge
                  key={interest}
                  variant="outline"
                  size="sm"
                  className="border-border/60 bg-background px-2 py-0 text-[11px]"
                >
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {(candidate.background || candidate.notes) && (
          <div className="space-y-2 text-[12px]">
            {candidate.background && (
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground/80">Background:</span> {candidate.background}
              </p>
            )}
            {candidate.notes && (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-2 text-muted-foreground">
                <span className="font-semibold text-foreground/80">Notiz:</span> {candidate.notes}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DomainSection({
  domain,
  candidates,
}: {
  domain: Domain;
  candidates: CandidateAggregate[];
}) {
  const label = domain === "acting" ? "Acting Talente" : "Crew Talente";

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        Keine Kandidat:innen für {label} verfügbar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <h3 className="font-semibold text-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground">{candidates.length} Profile</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-4 pb-2">
          {candidates.map((candidate) => (
            <CandidateCard key={`${domain}-${candidate.userId}`} candidate={candidate} activeDomain={domain} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RankingTab({ ranking }: RankingTabProps) {
  const [domain, setDomain] = useState<Domain>("acting");

  const actingRoles = useMemo(
    () =>
      ranking.roles
        .filter((role) => role.domain === "acting")
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, "de-DE")),
    [ranking.roles],
  );

  const crewRoles = useMemo(
    () =>
      ranking.roles
        .filter((role) => role.domain === "crew")
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, "de-DE")),
    [ranking.roles],
  );

  useEffect(() => {
    if (domain === "acting" && actingRoles.length === 0 && crewRoles.length > 0) {
      setDomain("crew");
    } else if (domain === "crew" && crewRoles.length === 0 && actingRoles.length > 0) {
      setDomain("acting");
    }
  }, [actingRoles.length, crewRoles.length, domain]);

  const candidateAggregates = useMemo(() => {
    const map = new Map<string, CandidateAggregate>();

    for (const role of ranking.roles) {
      for (const candidate of role.candidates) {
        let entry = map.get(candidate.userId);

        if (!entry) {
          entry = {
            userId: candidate.userId,
            name: candidate.name,
            email: candidate.email,
            focus: candidate.focus,
            score: candidate.score,
            confidence: candidate.confidence,
            experienceYears: candidate.experienceYears,
            interests: [...new Set(candidate.interests)],
            background: candidate.background,
            notes: candidate.notes,
            bestRank: candidate.rank,
            preferences: {
              acting: [],
              crew: [],
            },
          } satisfies CandidateAggregate;
          map.set(candidate.userId, entry);
        } else {
          entry.email = entry.email ?? candidate.email;
          entry.focus = entry.focus ?? candidate.focus;
          entry.score = Math.max(entry.score, candidate.score);
          entry.confidence = Math.max(entry.confidence, candidate.confidence);
          entry.experienceYears =
            entry.experienceYears === null
              ? candidate.experienceYears
              : candidate.experienceYears === null
                ? entry.experienceYears
                : Math.max(entry.experienceYears, candidate.experienceYears);
          entry.interests = Array.from(new Set([...entry.interests, ...candidate.interests]));
          entry.background = entry.background ?? candidate.background;
          entry.notes = entry.notes ?? candidate.notes;
          entry.bestRank = entry.bestRank === null ? candidate.rank : Math.min(entry.bestRank, candidate.rank);
        }

        const addPreference = (prefDomain: Domain, pref: CandidatePreference) => {
          const list = entry!.preferences[prefDomain];
          const existingIndex = list.findIndex((item) => item.roleId === pref.roleId);
          if (existingIndex === -1) {
            list.push(pref);
          } else if (list[existingIndex].share < pref.share) {
            list[existingIndex] = pref;
          }
        };

        addPreference(role.domain, {
          roleId: role.roleId,
          label: role.label,
          share: candidate.normalizedShare,
          rank: candidate.rank,
        });

        for (const otherPreference of candidate.otherPreferences) {
          addPreference(otherPreference.domain, {
            roleId: otherPreference.roleId,
            label: otherPreference.label,
            share: otherPreference.normalizedShare,
            rank: otherPreference.rank,
          });
        }
      }
    }

    const aggregates = Array.from(map.values());

    for (const aggregate of aggregates) {
      aggregate.preferences.acting.sort((a, b) => b.share - a.share);
      aggregate.preferences.crew.sort((a, b) => b.share - a.share);
    }

    return aggregates;
  }, [ranking.roles]);

  const actingCandidates = useMemo(
    () =>
      candidateAggregates
        .filter((candidate) => candidate.preferences.acting.length > 0)
        .slice()
        .sort(
          (a, b) => (b.preferences.acting[0]?.share ?? 0) - (a.preferences.acting[0]?.share ?? 0),
        ),
    [candidateAggregates],
  );

  const crewCandidates = useMemo(
    () =>
      candidateAggregates
        .filter((candidate) => candidate.preferences.crew.length > 0)
        .slice()
        .sort((a, b) => (b.preferences.crew[0]?.share ?? 0) - (a.preferences.crew[0]?.share ?? 0)),
    [candidateAggregates],
  );

  return (
    <Tabs value={domain} onValueChange={(value) => setDomain(value as Domain)} className="space-y-6">
      <TabsList className="w-fit bg-muted/40">
        <TabsTrigger value="acting">Acting</TabsTrigger>
        <TabsTrigger value="crew">Crew</TabsTrigger>
      </TabsList>
      <TabsContent value="acting" className="mt-0 space-y-4">
        {actingRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Daten für {domainLabels.acting} verfügbar.
          </p>
        ) : (
          <>
            <RoleSpiderChart
              title="Acting Rollenpräferenzen"
              subtitle="Verteilung der Rollengrößen nach Präferenzstärke"
              data={actingRoles.map((role) => ({
                label: role.label,
                value:
                  (role.candidates.reduce((sum, c) => sum + c.normalizedShare, 0) /
                    Math.max(role.candidates.length, 1)) *
                  100,
              }))}
            />

            <DomainSection domain="acting" candidates={actingCandidates} />
          </>
        )}
      </TabsContent>
      <TabsContent value="crew" className="mt-0 space-y-4">
        {crewRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Daten für {domainLabels.crew} verfügbar.
          </p>
        ) : (
          <>
            <RoleSpiderChart
              title="Crew Rollenpräferenzen"
              subtitle="Verteilung der Gewerke nach Präferenzstärke"
              data={crewRoles.map((role) => ({
                label: role.label,
                value:
                  (role.candidates.reduce((sum, c) => sum + c.normalizedShare, 0) /
                    Math.max(role.candidates.length, 1)) *
                  100,
              }))}
            />

            <DomainSection domain="crew" candidates={crewCandidates} />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
