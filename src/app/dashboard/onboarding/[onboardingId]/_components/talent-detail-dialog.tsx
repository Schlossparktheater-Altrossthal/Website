"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { RoleSpiderChart } from "./role-spider-chart";
import type { CandidateAggregate, HighlightContext } from "./ranking-types";

const percentageFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const scoreFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const securityFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function PreferenceDetail({
  domain,
  preferences,
}: {
  domain: "acting" | "crew";
  preferences: CandidateAggregate["preferences"]["acting"];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-4">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{domain === "acting" ? "Acting" : "Gewerk"}</span>
        {preferences.length > 0 && (
          <span>{percentageFormatter.format(preferences[0].share * 100)}%</span>
        )}
      </div>
      {preferences.length === 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground/80">
          Keine Präferenzen hinterlegt.
        </p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {preferences.map((preference, index) => (
            <li
              key={`${domain}-${preference.roleId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-muted-foreground">
                  #{preference.rank}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground/90">{preference.label}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    {domain === "acting" ? "Acting" : "Crew"} #{index + 1}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground/80">
                {percentageFormatter.format(preference.share * 100)}%
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function TalentDetailDialog({
  candidate,
  highlight,
  open,
  onOpenChange,
}: {
  candidate: CandidateAggregate | null;
  highlight: HighlightContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actingPreferences = candidate?.preferences.acting ?? [];
  const crewPreferences = candidate?.preferences.crew ?? [];

  const actingSpiderData = actingPreferences.map((preference) => ({
    label: preference.label,
    value: preference.share * 100,
  }));

  const crewSpiderData = crewPreferences.map((preference) => ({
    label: preference.label,
    value: preference.share * 100,
  }));

  const confidence = candidate
    ? `${securityFormatter.format(candidate.confidence * 100)}%`
    : null;

  const score = candidate ? scoreFormatter.format(candidate.score) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            {candidate?.name ?? "Talentprofil"}
          </DialogTitle>
          <DialogDescription>
            Detailansicht der Onboarding-Präferenzen und Hintergründe.
          </DialogDescription>
          {highlight && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <Badge variant="muted" size="sm" className="font-semibold uppercase tracking-wide">
                {highlight.label}
              </Badge>
              <Badge variant="outline" size="sm">
                #{highlight.rank}
              </Badge>
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
                {percentageFormatter.format(highlight.share * 100)}% Präferenzanteil
              </span>
            </div>
          )}
        </DialogHeader>

        {candidate ? (
          <div className="space-y-6">
            <section className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Kontakt
                </p>
                <p className={cn("font-medium text-foreground", !candidate.email && "text-muted-foreground/70")}>
                  {candidate.email ?? "Keine E-Mail hinterlegt"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Fokus & Sicherheit
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {candidate.focus && (
                    <Badge variant="secondary" size="sm" className="font-semibold uppercase tracking-wide">
                      {candidate.focus === "acting"
                        ? "Fokus Acting"
                        : candidate.focus === "tech"
                          ? "Fokus Technik"
                          : "Fokus Acting + Crew"}
                    </Badge>
                  )}
                  {score && (
                    <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
                      Score {score}
                    </span>
                  )}
                  {confidence && (
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-foreground/80">
                      {confidence} Sicherheit
                    </span>
                  )}
                  {candidate.experienceYears !== null && (
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-foreground/80">
                      {candidate.experienceYears === 0
                        ? "Neu im Bereich"
                        : `${candidate.experienceYears} Jahre Erfahrung`}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {candidate.interests.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Interessen & Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant="outline"
                      size="sm"
                      className="border-border/60 bg-background/80 px-2 py-0 text-[11px] font-medium"
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {(candidate.background || candidate.notes) && (
              <section className="grid gap-4 text-sm text-muted-foreground lg:grid-cols-2">
                {candidate.background && (
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/40 p-4">
                    <h3 className="text-sm font-semibold text-foreground">Background</h3>
                    <p className="leading-relaxed text-muted-foreground/90">{candidate.background}</p>
                  </div>
                )}
                {candidate.notes && (
                  <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-background/80 p-4">
                    <h3 className="text-sm font-semibold text-foreground">Notizen aus dem Onboarding</h3>
                    <p className="leading-relaxed text-muted-foreground/90">{candidate.notes}</p>
                  </div>
                )}
              </section>
            )}

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Präferenzradar
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <RoleSpiderChart
                    title="Acting Präferenzen"
                    subtitle="Stärken der favorisierten Rollen"
                    data={actingSpiderData}
                    accentColor="var(--chart-3)"
                    size={260}
                  />
                  <PreferenceDetail domain="acting" preferences={actingPreferences} />
                </div>
                <div className="space-y-3">
                  <RoleSpiderChart
                    title="Crew Präferenzen"
                    subtitle="Verteilung der Gewerke"
                    data={crewSpiderData}
                    accentColor="var(--chart-4)"
                    size={260}
                  />
                  <PreferenceDetail domain="crew" preferences={crewPreferences} />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Profildaten verfügbar.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
