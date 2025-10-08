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
  preferences: Record<Domain, CandidatePreference[]>;
};

type HighlightContext = {
  domain: Domain;
  roleId: string;
  label: string;
  rank: number;
  share: number;
};

function PreferenceList({
  domain,
  preferences,
  highlight,
}: {
  domain: Domain;
  preferences: CandidatePreference[];
  highlight: HighlightContext;
}) {
  const activeRoleId = highlight.domain === domain ? highlight.roleId : null;

  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{domain === "acting" ? "Acting" : "Gewerk"}</span>
        {preferences.length > 0 && (
          <span>{percentageFormatter.format(preferences[0].share * 100)}%</span>
        )}
      </div>
      {preferences.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground/80">Keine Präferenzen vorhanden.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-xs">
          {preferences.map((pref) => {
            const isActive = pref.roleId === activeRoleId;
            return (
              <li
                key={`${domain}-${pref.roleId}`}
                className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 leading-snug transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/30"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                    }`}
                  >
                    {pref.rank}
                  </span>
                  <span className="font-medium text-foreground/90">{pref.label}</span>
                </div>
                <span className="shrink-0 font-semibold text-foreground/80">
                  {percentageFormatter.format(pref.share * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  highlight,
}: {
  candidate: CandidateAggregate;
  highlight: HighlightContext;
}) {
  const experienceLabel =
    candidate.experienceYears === null
      ? null
      : candidate.experienceYears === 0
        ? "Neu im Bereich"
        : `${candidate.experienceYears} Jahre Erfahrung`;
  const securityLabel = `${numberFormatter.format(Math.round(candidate.confidence * 100))}% Sicherheit`;

  return (
    <Card className="h-full border-border/50">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="muted" size="sm" className="font-semibold">
                {highlight.label}
              </Badge>
              <Badge variant="default" size="sm">
                #{highlight.rank}
              </Badge>
              <span className="font-semibold text-foreground/80">
                {percentageFormatter.format(highlight.share * 100)}% Präferenz
              </span>
            </div>
            <CardTitle className="text-base font-semibold text-foreground">
              {candidate.name}
            </CardTitle>
            {candidate.email && (
              <p className="text-xs text-muted-foreground break-words">{candidate.email}</p>
            )}
          </div>
          {candidate.focus && (
            <Badge variant={focusVariant[candidate.focus]} size="sm" className="shrink-0">
              {focusLabel[candidate.focus]}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {experienceLabel && (
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
              {experienceLabel}
            </span>
          )}
          <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-foreground/80">
            Score {scoreFormatter.format(candidate.score)}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-foreground/80">
            {securityLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <PreferenceList
            domain="acting"
            preferences={candidate.preferences.acting}
            highlight={highlight}
          />
          <PreferenceList
            domain="crew"
            preferences={candidate.preferences.crew}
            highlight={highlight}
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

type RoleCandidate = {
  candidate: CandidateAggregate;
  highlight: HighlightContext;
};

type RoleGroup = {
  roleId: string;
  label: string;
  domain: Domain;
  candidates: RoleCandidate[];
};

type RoleSummary = {
  roleId: string;
  label: string;
  domain: Domain;
  averageShare: number;
};

function DomainSection({ domain, groups }: { domain: Domain; groups: RoleGroup[] }) {
  const label = domain === "acting" ? "Acting Talente" : "Crew Talente";

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        Keine Kandidat:innen für {label} verfügbar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.roleId} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <h3 className="font-semibold text-foreground">{group.label}</h3>
            <span className="text-xs text-muted-foreground">
              {group.candidates.length} {group.candidates.length === 1 ? "Profil" : "Profile"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.candidates.map(({ candidate, highlight }) => (
              <CandidateCard
                key={`${group.roleId}-${candidate.userId}`}
                candidate={candidate}
                highlight={highlight}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function RankingTab({ ranking }: RankingTabProps) {
  const [domain, setDomain] = useState<Domain>("acting");

  const roleSummaries = useMemo<RoleSummary[]>(() => {
    return ranking.roles.map((role) => {
      const totalShare = role.candidates.reduce((sum, candidate) => sum + candidate.normalizedShare, 0);
      const averageShare =
        role.candidates.length === 0 ? 0 : totalShare / role.candidates.length;

      return {
        roleId: role.roleId,
        label: role.label,
        domain: role.domain as Domain,
        averageShare,
      } satisfies RoleSummary;
    });
  }, [ranking.roles]);

  const roleSummaryMap = useMemo(
    () => new Map<string, RoleSummary>(roleSummaries.map((summary) => [summary.roleId, summary])),
    [roleSummaries],
  );

  const actingRoleSummaries = useMemo(
    () =>
      roleSummaries
        .filter((summary) => summary.domain === "acting")
        .slice()
        .sort((a, b) => {
          if (b.averageShare === a.averageShare) {
            return a.label.localeCompare(b.label, "de-DE");
          }
          return b.averageShare - a.averageShare;
        }),
    [roleSummaries],
  );

  const crewRoleSummaries = useMemo(
    () =>
      roleSummaries
        .filter((summary) => summary.domain === "crew")
        .slice()
        .sort((a, b) => {
          if (b.averageShare === a.averageShare) {
            return a.label.localeCompare(b.label, "de-DE");
          }
          return b.averageShare - a.averageShare;
        }),
    [roleSummaries],
  );

  useEffect(() => {
    if (domain === "acting" && actingRoleSummaries.length === 0 && crewRoleSummaries.length > 0) {
      setDomain("crew");
    } else if (domain === "crew" && crewRoleSummaries.length === 0 && actingRoleSummaries.length > 0) {
      setDomain("acting");
    }
  }, [actingRoleSummaries.length, crewRoleSummaries.length, domain]);

  const roleGroups = useMemo(() => {
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

    for (const aggregate of map.values()) {
      aggregate.preferences.acting.sort((a, b) => b.share - a.share);
      aggregate.preferences.crew.sort((a, b) => b.share - a.share);
    }

    const groups = ranking.roles.map((role) => ({
      roleId: role.roleId,
      label: role.label,
      domain: role.domain as Domain,
      candidates: role.candidates.map((candidate) => {
        const aggregate = map.get(candidate.userId);
        return {
          candidate: aggregate!,
          highlight: {
            domain: role.domain as Domain,
            roleId: role.roleId,
            label: role.label,
            rank: candidate.rank,
            share: candidate.normalizedShare,
          },
        } satisfies RoleCandidate;
      }),
    } satisfies RoleGroup));

    return groups;
  }, [ranking.roles]);

  const actingGroups = useMemo(
    () =>
      roleGroups
        .filter((group) => group.domain === "acting" && group.candidates.length > 0)
        .map((group) => ({
          ...group,
          candidates: group.candidates.slice().sort((a, b) => a.highlight.rank - b.highlight.rank),
        }))
        .sort((a, b) => {
          const aSummary = roleSummaryMap.get(a.roleId)?.averageShare ?? 0;
          const bSummary = roleSummaryMap.get(b.roleId)?.averageShare ?? 0;
          if (bSummary === aSummary) {
            return a.label.localeCompare(b.label, "de-DE");
          }
          return bSummary - aSummary;
        }),
    [roleGroups, roleSummaryMap],
  );

  const crewGroups = useMemo(
    () =>
      roleGroups
        .filter((group) => group.domain === "crew" && group.candidates.length > 0)
        .map((group) => ({
          ...group,
          candidates: group.candidates.slice().sort((a, b) => a.highlight.rank - b.highlight.rank),
        }))
        .sort((a, b) => {
          const aSummary = roleSummaryMap.get(a.roleId)?.averageShare ?? 0;
          const bSummary = roleSummaryMap.get(b.roleId)?.averageShare ?? 0;
          if (bSummary === aSummary) {
            return a.label.localeCompare(b.label, "de-DE");
          }
          return bSummary - aSummary;
        }),
    [roleGroups, roleSummaryMap],
  );

  return (
    <Tabs value={domain} onValueChange={(value) => setDomain(value as Domain)} className="space-y-6">
      <TabsList className="w-fit bg-muted/40">
        <TabsTrigger value="acting">Acting</TabsTrigger>
        <TabsTrigger value="crew">Crew</TabsTrigger>
      </TabsList>
      <TabsContent value="acting" className="mt-0 space-y-4">
        {actingRoleSummaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Daten für {domainLabels.acting} verfügbar.
          </p>
        ) : (
          <>
            <RoleSpiderChart
              title="Acting Rollenpräferenzen"
              subtitle="Verteilung der Rollengrößen nach Präferenzstärke"
              data={actingRoleSummaries.map((role) => ({
                label: role.label,
                value: role.averageShare * 100,
              }))}
            />

            <DomainSection domain="acting" groups={actingGroups} />
          </>
        )}
      </TabsContent>
      <TabsContent value="crew" className="mt-0 space-y-4">
        {crewRoleSummaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Daten für {domainLabels.crew} verfügbar.
          </p>
        ) : (
          <>
            <RoleSpiderChart
              title="Crew Rollenpräferenzen"
              subtitle="Verteilung der Gewerke nach Präferenzstärke"
              data={crewRoleSummaries.map((role) => ({
                label: role.label,
                value: role.averageShare * 100,
              }))}
            />

            <DomainSection domain="crew" groups={crewGroups} />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
