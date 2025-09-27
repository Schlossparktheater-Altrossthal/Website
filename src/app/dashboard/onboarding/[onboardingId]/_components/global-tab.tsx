"use client";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";

import { DistributionBars } from "./distribution-bars";
import { FocusDistributionSummary } from "./focus-distribution-summary";
import { InterestsSection } from "./interests-section";
import { MetricCard } from "./metric-card";
import { NutritionSection } from "./nutrition-section";
import { ProcessSection } from "./process-section";
import { RoleHeatmap } from "./role-heatmap";

type GlobalOverviewTabProps = {
  data: OnboardingDashboardData["global"];
  participants: number;
};

function RoleDistribution({
  title,
  roles,
  coverage,
}: {
  title: string;
  roles: OnboardingDashboardData["global"]["rolesActing"];
  coverage: number;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">{title}</CardTitle>
          <Badge variant={coverage >= 70 ? "success" : coverage >= 40 ? "warning" : "destructive"}>
            {coverage.toFixed(0)}% Coverage
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Normierte Präferenzen & Anteil beteiligter Personen.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Präferenzdaten vorhanden.</p>
        ) : (
          <ul className="space-y-3">
            {roles.map((role, index) => (
              <li key={role.roleId} className="space-y-1">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">{role.label}</span>
                  <span className="text-foreground/80">{(role.normalizedShare * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, role.normalizedShare * 100)}%` }}
                    transition={{ delay: index * 0.05, duration: 0.45, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary/60"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Beteiligung: {role.participantShare.toFixed(0)}% der Teilnehmenden
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function GlobalOverviewTab({ data, participants }: GlobalOverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FocusDistributionSummary items={data.focusDistribution} />
        {data.kpis.map((metric, index) => (
          <MetricCard key={metric.id} metric={metric} index={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <DistributionBars title="Altersgruppen" items={data.ageGroups} subtitle="Verteilung der angegebenen Altersgruppen" />
        <DistributionBars title="Geschlechter" items={data.genderDistribution} subtitle="Selbstangaben" />
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Fotoeinverständnis</CardTitle>
            <p className="text-sm text-muted-foreground">Quote bestätigter Einverständnisse.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-4xl font-semibold">
              {data.photoConsentRate !== null ? `${(data.photoConsentRate * 100).toFixed(0)}%` : "–"}
            </div>
            <p className="text-sm text-muted-foreground">
              {data.photoConsentRate !== null
                ? `${Math.round((data.photoConsentRate || 0) * participants)} von ${participants} Personen`
                : "Es liegen keine Angaben vor."}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <RoleDistribution
          title="Rollenpräferenzen (Acting)"
          roles={data.rolesActing}
          coverage={data.roleCoverage.acting}
        />
        <RoleDistribution
          title="Gewerkepräferenzen (Crew)"
          roles={data.rolesCrew}
          coverage={data.roleCoverage.crew}
        />
        <RoleHeatmap
          data={data.roleHeatmap}
          subtitle="Intensität der Doppel-Präferenzen acting × crew"
          title="Heatmap"
        />
      </div>
      <InterestsSection
        topTags={data.interestTopTags}
        wordCloud={data.interestWordCloud}
        coOccurrences={data.interestCoOccurrences}
        clusters={data.interestClusters}
        diversity={data.diversity}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <NutritionSection data={data.nutrition} totalParticipants={participants} />
        <ProcessSection steps={data.process.steps} documents={data.process.documents} />
      </div>
    </div>
  );
}
