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



function CandidateCard({
  candidate,
}: {
  candidate: OnboardingDashboardData["ranking"]["roles"][number]["candidates"][number];
}) {
  const shareLabel = percentageFormatter.format(candidate.normalizedShare * 100);
  const confidencePercentage = Math.round(candidate.confidence * 100);
  const interestPreview = candidate.interests.slice(0, 3);
  const remainingInterests = candidate.interests.length - interestPreview.length;

  return (
    <div className="group relative rounded-lg border border-border/50 bg-card p-3 transition-all hover:border-border hover:shadow-sm">
      {/* Header mit Name und Rang */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {candidate.rank}
            </span>
            <h4 className="truncate text-sm font-semibold text-foreground">{candidate.name}</h4>
          </div>
          
          {/* Kompakte Metriken */}
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{shareLabel}% Präferenz</span>
              <span className="text-muted-foreground/60">•</span>
              <span>Score {scoreFormatter.format(candidate.score)}</span>
              <span className="text-muted-foreground/60">•</span>
              <span>{numberFormatter.format(confidencePercentage)}% Sicherheit</span>
            </div>
            {candidate.email && (
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{candidate.email}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Fokus Badge */}
        {candidate.focus && (
          <Badge variant={focusVariant[candidate.focus]} size="sm" className="shrink-0">
            {focusLabel[candidate.focus]}
          </Badge>
        )}
      </div>

      {/* Eigenschaften kompakt */}
      <div className="space-y-2">
        {/* Erfahrung und Interessen in einer Zeile */}
        <div className="flex flex-wrap items-center gap-1.5">
          {candidate.experienceYears !== null && (
            <Badge variant="secondary" size="sm">
              {candidate.experienceYears === 0 ? "Neu" : `${candidate.experienceYears}J`}
            </Badge>
          )}
          {interestPreview.map((interest) => (
            <Badge key={interest} variant="muted" size="sm" className="text-[10px]">
              {interest}
            </Badge>
          ))}
          {remainingInterests > 0 && (
            <Badge variant="ghost" size="sm" className="text-[10px]">
              +{remainingInterests}
            </Badge>
          )}
        </div>

        {/* Weitere Präferenzen kompakter */}
        {candidate.otherPreferences.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
            {candidate.otherPreferences.slice(0, 3).map((pref) => (
              <span key={`${pref.domain}-${pref.roleId}`} className="rounded bg-muted/50 px-1.5 py-0.5">
                #{pref.rank} {pref.label} ({percentageFormatter.format(pref.normalizedShare * 100)}%)
              </span>
            ))}
            {candidate.otherPreferences.length > 3 && (
              <span className="rounded bg-muted/30 px-1.5 py-0.5">+{candidate.otherPreferences.length - 3}</span>
            )}
          </div>
        )}

        {/* Background/Notes sehr kompakt */}
        {(candidate.background || candidate.notes) && (
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {candidate.background && (
              <p className="line-clamp-1">
                <span className="font-medium text-foreground/70">BG:</span> {candidate.background}
              </p>
            )}
            {candidate.notes && (
              <p className="line-clamp-1">
                <span className="font-medium text-foreground/70">Note:</span> {candidate.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RoleColumn({
  domain,
  role,
}: {
  domain: Domain;
  role: OnboardingDashboardData["ranking"]["roles"][number];
}) {
  return (
    <Card className="h-full border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            {role.label}
          </CardTitle>
          <Badge variant="muted" size="sm" className="text-[10px]">
            {role.demand} Personen
          </Badge>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ranking nach {domain === "acting" ? "Rollengrößen" : "Gewerken"}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {role.candidates.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">Keine Kandidat:innen</p>
          </div>
        ) : (
          role.candidates.map((candidate) => (
            <CandidateCard key={candidate.userId} candidate={candidate} />
          ))
        )}
      </CardContent>
    </Card>
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
            {/* Spiderdiagramm für Acting-Präferenzen */}
            <RoleSpiderChart
              title="Acting Rollenpräferenzen"
              subtitle="Verteilung der Rollengrößen nach Präferenzstärke"
              data={actingRoles.map((role) => ({
                label: role.label,
                value: role.candidates.reduce((sum, c) => sum + c.normalizedShare, 0) / Math.max(role.candidates.length, 1) * 100
              }))}
            />
            
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {actingRoles.map((role) => (
                <RoleColumn key={role.roleId} role={role} domain="acting" />
              ))}
            </div>
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
            {/* Spiderdiagramm für Crew-Präferenzen */}
            <RoleSpiderChart
              title="Crew Rollenpräferenzen"
              subtitle="Verteilung der Gewerke nach Präferenzstärke"
              data={crewRoles.map((role) => ({
                label: role.label,
                value: role.candidates.reduce((sum, c) => sum + c.normalizedShare, 0) / Math.max(role.candidates.length, 1) * 100
              }))}
            />
            
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {crewRoles.map((role) => (
                <RoleColumn key={role.roleId} role={role} domain="crew" />
              ))}
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
