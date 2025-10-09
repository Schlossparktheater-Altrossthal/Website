"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";
import { cn } from "@/lib/utils";
import { RoleSpiderChart } from "./role-spider-chart";
import {
  buildCandidateAggregates,
  createRoleGroups,
  createRoleSummaries,
  sortRoleGroupsByDomain,
  sortRoleSummariesByDomain,
} from "./ranking-data";
import type {
  CandidateAggregate,
  CandidatePreference,
  Domain,
  HighlightContext,
  RoleGroup,
  RoleSummary,
} from "./ranking-types";

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
  onboardingId: string;
  detailHrefTemplate: string;
};

function formatDetailHref(template: string, onboardingId: string, candidateId: string) {
  let index = 0;
  const replacements = [onboardingId, candidateId] as const;
  return template.replace(/%s/g, () => encodeURIComponent(replacements[index++] ?? ""));
}

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
                className={cn(
                  "rounded-lg px-2.5 py-1.5 leading-snug transition-colors",
                  "border border-transparent bg-muted/40",
                  isActive
                    ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/30"
                    : "text-muted-foreground",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {pref.rank}
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-foreground/90">
                    {pref.label}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] font-semibold text-foreground/80">
                    {percentageFormatter.format(pref.share * 100)}%
                  </span>
                </div>
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
  onSelectCandidate,
}: {
  candidate: CandidateAggregate;
  highlight: HighlightContext;
  onSelectCandidate: (candidate: CandidateAggregate, highlight: HighlightContext) => void;
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
              <button
                type="button"
                onClick={() => onSelectCandidate(candidate, highlight)}
                className="rounded-md text-left text-base font-semibold text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {candidate.name}
              </button>
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

function DomainSection({
  domain,
  groups,
  onSelectCandidate,
}: {
  domain: Domain;
  groups: RoleGroup[];
  onSelectCandidate: (candidate: CandidateAggregate, highlight: HighlightContext) => void;
}) {
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
                onSelectCandidate={onSelectCandidate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function RankingTab({ ranking, onboardingId, detailHrefTemplate }: RankingTabProps) {
  const [domain, setDomain] = useState<Domain>("acting");
  const router = useRouter();

  const handleSelectCandidate = useCallback(
    (candidate: CandidateAggregate, highlight: HighlightContext) => {
      const baseHref = formatDetailHref(detailHrefTemplate, onboardingId, candidate.userId);
      const href = highlight
        ? `${baseHref}${baseHref.includes("?") ? "&" : "?"}roleId=${encodeURIComponent(highlight.roleId)}`
        : baseHref;
      router.push(href);
    },
    [detailHrefTemplate, onboardingId, router],
  );

  const { actingRoleSummaries, crewRoleSummaries, actingGroups, crewGroups } = useMemo(() => {
    const candidateMap = buildCandidateAggregates(ranking);
    const summaries = createRoleSummaries(ranking);
    const summaryMap = new Map<string, RoleSummary>(summaries.map((summary) => [summary.roleId, summary]));
    const groups = createRoleGroups(ranking, candidateMap);

    return {
      actingRoleSummaries: sortRoleSummariesByDomain(summaries, "acting"),
      crewRoleSummaries: sortRoleSummariesByDomain(summaries, "crew"),
      actingGroups: sortRoleGroupsByDomain(groups, "acting", summaryMap),
      crewGroups: sortRoleGroupsByDomain(groups, "crew", summaryMap),
    };
  }, [ranking]);

  useEffect(() => {
    if (domain === "acting" && actingRoleSummaries.length === 0 && crewRoleSummaries.length > 0) {
      setDomain("crew");
    } else if (domain === "crew" && crewRoleSummaries.length === 0 && actingRoleSummaries.length > 0) {
      setDomain("acting");
    }
  }, [actingRoleSummaries.length, crewRoleSummaries.length, domain]);

  return (
    <>
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

            <DomainSection
              domain="acting"
              groups={actingGroups}
              onSelectCandidate={handleSelectCandidate}
            />
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

            <DomainSection
              domain="crew"
              groups={crewGroups}
              onSelectCandidate={handleSelectCandidate}
            />
          </>
        )}
        </TabsContent>
      </Tabs>

    </>
  );
}
