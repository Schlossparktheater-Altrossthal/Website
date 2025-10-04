"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";

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

function renderPreferenceBadges(
  preferences: OnboardingDashboardData["ranking"]["roles"][number]["candidates"][number]["otherPreferences"],
  label: string,
) {
  if (preferences.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {preferences.map((preference) => (
          <Badge key={`${preference.domain}-${preference.roleId}-${preference.rank}`} variant="ghost" size="sm">
            #{preference.rank} {preference.label}
            <span className="ml-1 text-foreground/70">
              {percentageFormatter.format(preference.normalizedShare * 100)}%
            </span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
}: {
  candidate: OnboardingDashboardData["ranking"]["roles"][number]["candidates"][number];
}) {
  const preferenceGroups = useMemo(() => {
    const acting = candidate.otherPreferences.filter((item) => item.domain === "acting");
    const crew = candidate.otherPreferences.filter((item) => item.domain === "crew");
    return { acting, crew };
  }, [candidate.otherPreferences]);

  const shareLabel = percentageFormatter.format(candidate.normalizedShare * 100);
  const confidencePercentage = Math.round(candidate.confidence * 100);
  const interestPreview = candidate.interests.slice(0, 4);
  const remainingInterests = candidate.interests.length - interestPreview.length;

  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xs font-semibold text-muted-foreground">#{candidate.rank}</span>
          <div>
            <p className="text-sm font-semibold leading-5 text-foreground">{candidate.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {candidate.focus ? (
                <Badge variant={focusVariant[candidate.focus]} size="sm">
                  {focusLabel[candidate.focus]}
                </Badge>
              ) : null}
              <Badge variant="outline" size="sm">
                {shareLabel}% Präferenz
              </Badge>
              <Badge variant="ghost" size="sm">
                Score {scoreFormatter.format(candidate.score)}
              </Badge>
              <Badge variant="info" size="sm">
                Sicherheit {numberFormatter.format(confidencePercentage)}%
              </Badge>
              {candidate.experienceYears !== null ? (
                <Badge variant="secondary" size="sm">
                  {candidate.experienceYears === 0
                    ? "Neu dabei"
                    : `${candidate.experienceYears} Jahre Erfahrung`}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {candidate.interests.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {interestPreview.map((interest) => (
            <Badge key={interest} variant="muted" size="sm">
              #{interest}
            </Badge>
          ))}
          {remainingInterests > 0 ? (
            <Badge variant="ghost" size="sm">+{remainingInterests}</Badge>
          ) : null}
        </div>
      ) : null}

      {(preferenceGroups.acting.length > 0 || preferenceGroups.crew.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {preferenceGroups.acting.length > 0
            ? renderPreferenceBadges(preferenceGroups.acting, "Acting")
            : null}
          {preferenceGroups.crew.length > 0
            ? renderPreferenceBadges(preferenceGroups.crew, "Crew")
            : null}
        </div>
      )}

      {candidate.background ? (
        <p className="mt-4 text-xs text-muted-foreground line-clamp-2">
          <span className="font-semibold text-foreground/80">Background:</span> {candidate.background}
        </p>
      ) : null}

      {candidate.notes ? (
        <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground line-clamp-3">
          <span className="font-semibold text-foreground/80">Notiz:</span> {candidate.notes}
        </p>
      ) : null}
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
    <Card className="h-full">
      <CardHeader className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            {role.label}
          </CardTitle>
          <Badge variant="muted" size="sm">
            {role.demand} Personen
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Ranking der stärksten Präferenzen für {domain === "acting" ? "Rollengrößen" : "Gewerke"}.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {role.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Angaben vorhanden.</p>
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
          <div className="grid gap-4 xl:grid-cols-2">
            {actingRoles.map((role) => (
              <RoleColumn key={role.roleId} role={role} domain="acting" />
            ))}
          </div>
        )}
      </TabsContent>
      <TabsContent value="crew" className="mt-0 space-y-4">
        {crewRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Daten für {domainLabels.crew} verfügbar.
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {crewRoles.map((role) => (
              <RoleColumn key={role.roleId} role={role} domain="crew" />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
