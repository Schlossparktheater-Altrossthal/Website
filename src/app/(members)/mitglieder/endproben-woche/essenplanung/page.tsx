import { ChefHat, CheckCircle2, ListPlus, Sparkles } from "lucide-react";
import Link from "next/link";
import type { AllergyLevel } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { MealPlanRecipeWorkbench } from "@/components/members/meal-plan-recipe-workbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  DISH_LIBRARY,
  MEAL_SLOTS,
  STYLE_BADGE_VARIANTS,
  loadMealPlanningContext,
} from "./meal-plan-context";
import { cn } from "@/lib/utils";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

export const dynamic = "force-dynamic";

const ALLERGY_LEVEL_LABELS: Record<AllergyLevel, string> = {
  MILD: "Leicht",
  MODERATE: "Mittel",
  SEVERE: "Stark",
  LETHAL: "Kritisch",
};

const ALLERGY_LEVEL_STYLES: Record<AllergyLevel, string> = {
  MILD: "border-emerald-300/50 bg-emerald-500/10 text-emerald-500",
  MODERATE: "border-amber-300/60 bg-amber-500/10 text-amber-500",
  SEVERE: "border-orange-400/60 bg-orange-500/15 text-orange-500",
  LETHAL: "border-red-500/70 bg-red-500/15 text-red-500",
};

export default async function EssensplanungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.essenplanung");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
        Kein Zugriff auf die Essensplanung.
      </div>
    );
  }

  const {
    show,
    totalParticipants,
    strictParticipants,
    participantsWithRestrictions,
    criticalRestrictionCount,
    styleSummaries,
    allergenSummaries,
    criticalAllergens,
    plannerDays,
    defaultParticipantCount,
    priorityProfiles,
  } = await loadMealPlanningContext();

  const finalWeekStart = show?.finalRehearsalWeekStart ?? null;
  const numberFormatter = new Intl.NumberFormat("de-DE");
  const finalWeekStartLabel = finalWeekStart
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(finalWeekStart)
    : null;
  const finalWeekCountdown = finalWeekStart
    ? Math.max(0, Math.ceil((finalWeekStart.getTime() - Date.now()) / 86_400_000))
    : null;
  const finalWeekEnd = finalWeekStart ? new Date(finalWeekStart.getTime() + 6 * 86_400_000) : null;
  const finalWeekRangeLabel = finalWeekStart && finalWeekEnd
    ? `${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(finalWeekStart)} – ${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(finalWeekEnd)}`
    : null;

  const metrics = [
    {
      label: "Profile erfasst",
      value: numberFormatter.format(totalParticipants),
      hint: `${numberFormatter.format(strictParticipants)} strikt • ${numberFormatter.format(participantsWithRestrictions)} Allergieprofile`,
    },
    {
      label: "Kritische Unverträglichkeiten",
      value: numberFormatter.format(criticalRestrictionCount),
      hint: `${numberFormatter.format(criticalAllergens.length)} sensible Allergene`,
    },
    {
      label: "Ernährungscluster",
      value: numberFormatter.format(styleSummaries.length),
      hint: styleSummaries.length
        ? `${styleSummaries[0].label} führt mit ${styleSummaries[0].share}%`
        : "Noch keine Angaben",
    },
    {
      label: finalWeekCountdown !== null ? "Countdown" : "Finale Woche",
      value: finalWeekCountdown !== null ? numberFormatter.format(finalWeekCountdown) : "Offen",
      hint: finalWeekCountdown !== null ? "Tage bis Start" : "Bitte Termin definieren",
    },
  ];
  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/endproben-woche/essenplanung"),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Essensplanung"
        description={`Plane kompakt die Verpflegung der Endprobenwoche – gebündelt nach Ernährungsstilen, Strengegraden und Allergierisiken. Dienste und Verantwortliche koordinierst du im Bereich "Dienstplan".`}
        breadcrumbs={breadcrumbs}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.66fr)_minmax(0,0.34fr)] xl:items-start">
        <div className="space-y-4">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background/80 shadow-[0_25px_60px_rgba(59,130,246,0.18)]">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <ChefHat className="h-5 w-5 text-primary" />
                  Finale Essensmatrix
                </CardTitle>
                {finalWeekStartLabel ? (
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                    Start {finalWeekStartLabel}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning/60 bg-warning/10 text-warning">
                    Datum fehlt
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Die Kennzahlen basieren auf aktuellen Onboarding-Profilen und aktiven Allergieeinträgen. Nutze sie als Startpunkt für die Menüplanung.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-primary/20 bg-background/80 p-3 shadow-sm backdrop-blur"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
                      {metric.label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{metric.value}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
                  </div>
                ))}
              </div>
              {finalWeekRangeLabel ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Geplante Versorgungsphase: {finalWeekRangeLabel}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <ListPlus className="h-5 w-5 text-primary" />
                Eigene Rezepte planen
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Statt automatischer Vorschläge setzt du jetzt auf eure eigene Kreativität: Mit der Rezeptwerkbank lassen sich individuelle Menüs, Mengen und Abläufe zusammenstellen.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Lege Zutaten, Portionen und Beschreibungen exakt für eure Gruppe fest.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Kombiniere Rezepte aus der Bibliothek mit komplett eigenen Kreationen.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Automatisch generierte Einkaufslisten helfen beim Delegieren der Aufgaben.</span>
                </li>
              </ul>
              <Button asChild className="w-full sm:w-auto">
                <Link href="#rezeptwerkbank">Rezept erstellen</Link>
              </Button>
            </CardContent>
          </Card>

          <section id="rezeptwerkbank" className="scroll-mt-24">
            <MealPlanRecipeWorkbench
              library={DISH_LIBRARY}
              days={plannerDays}
              defaultParticipants={defaultParticipantCount}
              mealSlots={MEAL_SLOTS}
              styleBadgeVariants={STYLE_BADGE_VARIANTS}
            />
          </section>
        </div>

        <div className="space-y-4">
          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Ernährungscluster</CardTitle>
              <p className="text-sm text-muted-foreground">
                Verteilung der gemeldeten Ernährungsstile inklusive dominanter Strengegrade. Nutze sie, um Buffet-Linien zu priorisieren.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {styleSummaries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Noch keine Angaben vorhanden.
                </p>
              ) : (
                styleSummaries.map((summary) => (
                  <div
                    key={summary.key}
                    className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{summary.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Strenge: {summary.dominantStrictnessLabel} ({summary.dominantStrictnessShare}%)
                        </p>
                      </div>
                      <Badge variant="outline" className="border-border/60 bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {summary.count} Personen · {summary.share}%
                      </Badge>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary/40 to-transparent"
                        style={{ width: `${summary.share}%` }}
                      />
                    </div>
                    {summary.sampleNames.length ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {summary.sampleNames.map((name) => (
                          <span key={name} className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5">
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Allergie-Watchlist</CardTitle>
              <p className="text-sm text-muted-foreground">
                Kritische Allergene mit betroffenen Personen und Schweregrad. Plane getrennte Ausgabestationen oder Zusatzbeschilderung.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {allergenSummaries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Keine aktiven Allergiehinweise.
                </p>
              ) : (
                allergenSummaries.map((entry) => {
                  const levelBadges = (Object.keys(entry.levels) as AllergyLevel[])
                    .filter((level) => entry.levels[level] > 0)
                    .map((level) => (
                      <span
                        key={`${entry.key}-${level}`}
                        className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {ALLERGY_LEVEL_LABELS[level]}: {entry.levels[level]}
                      </span>
                    ));
                  return (
                    <div
                      key={entry.key}
                      className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Betroffen: {entry.affectedNames.join(", ")}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0.5 text-xs",
                            ALLERGY_LEVEL_STYLES[entry.highestLevel] ?? "border-border/60 bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {ALLERGY_LEVEL_LABELS[entry.highestLevel]}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">{levelBadges}</div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Priorisierte Profile</CardTitle>
              <p className="text-sm text-muted-foreground">
                Mitglieder mit strikten Ernährungsangaben oder hohen Allergiestufen – ideal für individuelles Briefing und Testverkostungen.
              </p>
            </CardHeader>
            <CardContent>
              {priorityProfiles.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Keine kritischen Profile hervorgehoben.
                </p>
              ) : (
                <ul className="space-y-3">
                  {priorityProfiles.map((profile) => {
                    const remaining = profile.restrictions.length - 3;
                    return (
                      <li
                        key={profile.userId}
                        className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{profile.name}</p>
                            <p className="text-xs text-muted-foreground">{profile.strictnessLabel}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-transparent text-[11px]",
                              STYLE_BADGE_VARIANTS[profile.style] ?? "border-border/60 bg-muted/40 text-muted-foreground",
                            )}
                          >
                            {profile.styleLabel}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          {profile.restrictions.slice(0, 3).map((restriction, index) => (
                            <span
                              key={`${profile.userId}-${restriction.allergen}-${index}`}
                              className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5"
                            >
                              {restriction.allergen} · {ALLERGY_LEVEL_LABELS[restriction.level]}
                            </span>
                          ))}
                          {remaining > 0 ? (
                            <span className="rounded-full border border-border/40 bg-background/70 px-2 py-0.5">
                              +{remaining} weitere
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
