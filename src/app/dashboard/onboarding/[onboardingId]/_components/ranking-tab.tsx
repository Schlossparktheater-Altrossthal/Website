"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getRolePreferenceOrder, getRolePreferenceTitle } from "@/lib/onboarding/role-preferences";
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

type RoleFilter = "all" | string;

const roleAccentStyles: Record<string, string> = {
  acting_lead: "border-amber-400/60 bg-amber-500/10 dark:border-amber-400/40 dark:bg-amber-500/5",
  acting_medium: "border-orange-400/60 bg-orange-500/10 dark:border-orange-400/40 dark:bg-orange-500/5",
  acting_scout: "border-emerald-400/60 bg-emerald-500/10 dark:border-emerald-400/40 dark:bg-emerald-500/5",
  acting_statist: "border-sky-400/60 bg-sky-500/10 dark:border-sky-400/40 dark:bg-sky-500/5",
  crew_stage: "border-purple-400/55 bg-purple-500/10 dark:border-purple-400/40 dark:bg-purple-500/5",
  crew_tech: "border-cyan-400/55 bg-cyan-500/10 dark:border-cyan-400/40 dark:bg-cyan-500/5",
  crew_costume: "border-pink-400/55 bg-pink-500/10 dark:border-pink-400/40 dark:bg-pink-500/5",
  crew_makeup: "border-rose-400/55 bg-rose-500/10 dark:border-rose-400/40 dark:bg-rose-500/5",
  crew_direction: "border-indigo-400/55 bg-indigo-500/10 dark:border-indigo-400/40 dark:bg-indigo-500/5",
  crew_music: "border-lime-400/55 bg-lime-500/10 dark:border-lime-400/40 dark:bg-lime-500/5",
  crew_props: "border-teal-400/55 bg-teal-500/10 dark:border-teal-400/40 dark:bg-teal-500/5",
  crew_marketing: "border-amber-300/55 bg-amber-400/10 dark:border-amber-300/40 dark:bg-amber-400/5",
  default: "border-border/60 bg-muted/30",
};

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
  roleFilter,
  roleFilterLabel,
}: {
  domain: Domain;
  groups: RoleGroup[];
  onSelectCandidate: (candidate: CandidateAggregate, highlight: HighlightContext) => void;
  roleFilter: RoleFilter;
  roleFilterLabel: string | null;
}) {
  const label = domain === "acting" ? "Acting Talente" : "Crew Talente";

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        Keine Kandidat:innen für {label} verfügbar.
      </div>
    );
  }

  const visibleGroups =
    roleFilter === "all" ? groups : groups.filter((group) => group.roleId === roleFilter);

  if (visibleGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        {roleFilterLabel
          ? `Keine Profile für ${roleFilterLabel} verfügbar.`
          : "Keine Profile für den aktuellen Filter verfügbar."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => {
        const accentClass = roleAccentStyles[group.roleId] ?? roleAccentStyles.default;
        const profileLabel = `Profile: ${numberFormatter.format(group.candidates.length)}`;

        return (
          <section key={group.roleId}>
            <div
              className={cn(
                "rounded-2xl border px-4 py-5 shadow-sm transition-colors sm:px-6 sm:py-6",
                accentClass,
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">{group.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {domain === "acting"
                      ? "Rollengröße im Onboarding"
                      : "Crew-Schwerpunkt im Onboarding"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted" size="sm" className="bg-background/70 text-foreground/80">
                    {profileLabel}
                  </Badge>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-background/80 text-foreground/80"
                  >
                    Plätze: {group.demand}
                  </Badge>
                </div>
              </div>
              {group.candidates.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Keine Profile für diesen Bereich verfügbar.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.candidates.map(({ candidate, highlight }) => (
                    <CandidateCard
                      key={`${group.roleId}-${candidate.userId}`}
                      candidate={candidate}
                      highlight={highlight}
                      onSelectCandidate={onSelectCandidate}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function RankingTab({ ranking, onboardingId, detailHrefTemplate }: RankingTabProps) {
  const [domain, setDomain] = useState<Domain>("acting");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
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

  const roleFilterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();

    for (const role of ranking.roles) {
      counts.set(role.roleId, role.candidates.length);
      labels.set(role.roleId, role.label);
    }

    const buildOptions = (domain: Domain) => {
      const order = getRolePreferenceOrder(domain === "acting" ? "acting" : "crew");
      const base = order.map((roleId) => ({
        value: roleId,
        label: labels.get(roleId) ?? getRolePreferenceTitle(roleId),
        count: counts.get(roleId) ?? 0,
      }));

      const extras = ranking.roles
        .filter((role) => role.domain === domain && !order.includes(role.roleId))
        .map((role) => ({
          value: role.roleId,
          label: role.label,
          count: role.candidates.length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));

      return [...base, ...extras];
    };

    return {
      acting: buildOptions("acting"),
      crew: buildOptions("crew"),
    };
  }, [ranking.roles]);

  useEffect(() => {
    if (domain === "acting" && actingRoleSummaries.length === 0 && crewRoleSummaries.length > 0) {
      setDomain("crew");
    } else if (domain === "crew" && crewRoleSummaries.length === 0 && actingRoleSummaries.length > 0) {
      setDomain("acting");
    }
  }, [actingRoleSummaries.length, crewRoleSummaries.length, domain]);

  useEffect(() => {
    setRoleFilter("all");
  }, [domain]);

  const activeFilterOptions = domain === "acting" ? roleFilterOptions.acting : roleFilterOptions.crew;
  const totalProfiles = activeFilterOptions.reduce((sum, option) => sum + option.count, 0);
  const selectedRoleMeta =
    roleFilter === "all" ? null : activeFilterOptions.find((option) => option.value === roleFilter) ?? null;
  const filterLabel = domain === "acting" ? "Rollengröße" : "Gewerk";
  const filterDescription =
    domain === "acting"
      ? "Blende Rollengrößen aus, um gezielt nach passenden Talenten zu suchen."
      : "Blende Gewerke aus, um gezielt nach passenden Talenten zu suchen.";
  const allLabel = domain === "acting" ? "Alle Rollen" : "Alle Gewerke";

  return (
    <>
      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex sm:items-center sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground/90">
            {domain === "acting" ? "Rollengrößen filtern" : "Gewerke filtern"}
          </h2>
          <p className="text-xs text-muted-foreground">{filterDescription}</p>
        </div>
        <div className="flex items-center gap-3">
          <Label
            htmlFor="role-filter"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {filterLabel}
          </Label>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value)}>
            <SelectTrigger
              id="role-filter"
              className="w-[240px] border-border/60 bg-background/80 text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="flex items-center justify-between gap-3">
                <span>{allLabel}</span>
                <span className="text-xs text-muted-foreground">
                  {numberFormatter.format(totalProfiles)} Profile
                </span>
              </SelectItem>
              {activeFilterOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {numberFormatter.format(option.count)} Profile
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
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
                roleFilter={roleFilter}
                roleFilterLabel={selectedRoleMeta?.label ?? null}
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
                roleFilter={roleFilter}
                roleFilterLabel={selectedRoleMeta?.label ?? null}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

    </>
  );
}
