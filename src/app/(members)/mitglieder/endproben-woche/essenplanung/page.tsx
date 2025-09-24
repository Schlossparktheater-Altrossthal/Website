import {
  CalendarDays,
  ChefHat,
  NotebookPen,
  Palette,
  ShieldAlert,
  Sparkles,
  Users2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
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
import { ALLERGY_LEVEL_STYLES } from "@/data/allergy-styles";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

export const dynamic = "force-dynamic";

const ALLERGY_LEVEL_LABELS: Record<AllergyLevel, string> = {
  MILD: "Leicht",
  MODERATE: "Mittel",
  SEVERE: "Stark",
  LETHAL: "Kritisch",
};

type Metric = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
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
  } = await loadMealPlanningContext(session.user?.id);

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

  const metrics: Metric[] = [
    {
      label: "Profile erfasst",
      value: numberFormatter.format(totalParticipants),
      hint: `${numberFormatter.format(strictParticipants)} strikt • ${numberFormatter.format(participantsWithRestrictions)} Allergieprofile`,
      icon: Users2,
      accent: "border-sky-400/40 bg-sky-500/10 text-sky-500 ring-sky-500/20",
    },
    {
      label: "Kritische Unverträglichkeiten",
      value: numberFormatter.format(criticalRestrictionCount),
      hint: `${numberFormatter.format(criticalAllergens.length)} sensible Allergene`,
      icon: ShieldAlert,
      accent: "border-red-400/40 bg-red-500/10 text-red-500 ring-red-500/20",
    },
    {
      label: "Ernährungscluster",
      value: numberFormatter.format(styleSummaries.length),
      hint: styleSummaries.length
        ? `${styleSummaries[0].label} führt mit ${styleSummaries[0].share}%`
        : "Noch keine Angaben",
      icon: Palette,
      accent: "border-emerald-400/40 bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
    },
    {
      label: finalWeekCountdown !== null ? "Countdown" : "Finale Woche",
      value: finalWeekCountdown !== null ? numberFormatter.format(finalWeekCountdown) : "Offen",
      hint: finalWeekCountdown !== null ? "Tage bis Start" : "Bitte Termin definieren",
      icon: CalendarDays,
      accent: "border-primary/40 bg-primary/10 text-primary ring-primary/20",
    },
  ];

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/endproben-woche/essenplanung"),
  ];

  const highlightedAllergens = criticalAllergens.slice(0, 4);

  const quickActions = (
    <div className="flex flex-wrap items-center gap-2">
      {finalWeekRangeLabel ? (
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{finalWeekRangeLabel}</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="border-warning/60 bg-warning/10 text-warning">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Zeitraum festlegen</span>
        </Badge>
      )}
      <Badge variant="outline" className="border-border/60 bg-background/90 text-muted-foreground">
        <Users2 className="h-3.5 w-3.5" />
        <span>{numberFormatter.format(totalParticipants)} Profile</span>
      </Badge>
    </div>
  );

  return (
    <div className="space-y-8 xl:space-y-10">
      <PageHeader
        title="Essensplanung"
        description="Plane die Verpflegung der Endprobenwoche abgestimmt auf Ernährungsstile, Allergien und Portionen – inklusive eigener Rezeptideen."
        breadcrumbs={breadcrumbs}
        quickActions={quickActions}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:items-start">
        <div className="space-y-6">
          <Card className="relative overflow-hidden border border-primary/30 bg-background/95 shadow-[0_30px_80px_rgba(59,130,246,0.15)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -right-12 top-10 h-48 w-48 rounded-full bg-sky-500/15 blur-3xl" />
            </div>
            <CardHeader className="relative space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-2 text-xl font-semibold text-primary">
                    <ChefHat className="h-5 w-5" />
                    Finale Essensmatrix
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Die Kennzahlen basieren auf aktuellen Onboarding-Profilen und aktiven Allergieeinträgen. Nutze sie als Ausgangspunkt für die Menüplanung und Dienstverteilung.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {finalWeekStartLabel ? (
                    <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
                      <CalendarDays className="h-4 w-4" />
                      <span>Start {finalWeekStartLabel}</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-warning/60 bg-warning/10 text-warning">
                      <CalendarDays className="h-4 w-4" />
                      <span>Datum fehlt</span>
                    </Badge>
                  )}
                  {finalWeekCountdown !== null ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span>{numberFormatter.format(finalWeekCountdown)} Tage</span>
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/95 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="absolute -right-10 top-0 h-20 w-20 rounded-full bg-primary/5 blur-2xl" aria-hidden />
                      <div className="relative flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-primary ring-4",
                            metric.accent,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {metric.label}
                          </p>
                          <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
                          <p className="text-xs text-muted-foreground">{metric.hint}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {finalWeekRangeLabel ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span>Versorgungsphase: {finalWeekRangeLabel}</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>Lege den Zeitraum der Endprobenwoche fest, um Einkaufslisten zu präzisieren.</span>
                </div>
              )}
              {highlightedAllergens.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive" size="sm" className="gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Hochsensibel
                  </Badge>
                  {highlightedAllergens.map((allergen) => (
                    <span
                      key={allergen}
                      className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive"
                    >
                      {allergen}
                    </span>
                  ))}
                  {criticalAllergens.length > highlightedAllergens.length ? (
                    <span className="text-xs text-muted-foreground">
                      +{criticalAllergens.length - highlightedAllergens.length} weitere
                    </span>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-border/70 bg-background/90 shadow-sm">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="relative space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <NotebookPen className="h-5 w-5" />
                <CardTitle className="text-base font-semibold">Individuelle Rezeptplanung</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Kombiniere Bibliotheksrezepte mit euren eigenen Kreationen. Mengen und Einkaufslisten skalieren automatisch auf eure Gruppengröße.
              </p>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Eigene Rezepte werden nach dem Speichern direkt im Dropdown &bdquo;Eigene Rezepte&ldquo; verfügbar.</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
                  <span>Berücksichtige strikte Profile, um Stationen oder Kennzeichnungen rechtzeitig einzuplanen.</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="gap-2">
                  <Link href="#rezeptwerkbank">
                    <NotebookPen className="h-4 w-4" /> Rezeptwerkbank öffnen
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href="/mitglieder/endproben-woche/einkaufsliste">
                    <Sparkles className="h-3.5 w-3.5" /> Einkaufslisten ansehen
                  </Link>
                </Button>
              </div>
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

        <div className="space-y-6">
          <Card className="border border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="space-y-3 pb-0">
              <div className="flex items-center gap-2 text-primary">
                <Palette className="h-5 w-5" />
                <CardTitle className="text-base font-semibold">Ernährungscluster</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Verteilung der gemeldeten Ernährungsstile inklusive dominanter Strengegrade. Nutze sie, um Buffet-Linien und Testverkostungen zu priorisieren.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {styleSummaries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                  Noch keine Angaben vorhanden.
                </p>
              ) : (
                styleSummaries.map((summary) => (
                  <div
                    key={summary.key}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 shadow-sm"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" aria-hidden />
                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{summary.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Strenge: {summary.dominantStrictnessLabel} ({summary.dominantStrictnessShare}%)
                        </p>
                      </div>
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        {summary.count} Personen · {summary.share}%
                      </Badge>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary/45 to-transparent"
                        style={{ width: `${summary.share}%` }}
                      />
                    </div>
                    {summary.sampleNames.length ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {summary.sampleNames.map((name) => (
                          <span
                            key={name}
                            className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5"
                          >
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

          <Card className="border border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="space-y-3 pb-0">
              <div className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                <CardTitle className="text-base font-semibold text-foreground">Allergie-Watchlist</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Kritische Allergene mit betroffenen Personen und Schweregrad. Plane getrennte Ausgabestationen oder zusätzliche Kennzeichnungen ein.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {allergenSummaries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                  Keine aktiven Allergiehinweise.
                </p>
              ) : (
                allergenSummaries.map((entry) => {
                  const levelBadges = (Object.keys(entry.levels) as AllergyLevel[])
                    .filter((level) => entry.levels[level] > 0)
                    .map((level) => (
                      <Badge
                        key={`${entry.key}-${level}`}
                        variant="outline"
                        size="sm"
                        className="border-border/50 bg-background/90 text-[11px] text-muted-foreground"
                      >
                        {ALLERGY_LEVEL_LABELS[level]}: {entry.levels[level]}
                      </Badge>
                    ));
                  return (
                    <div
                      key={entry.key}
                      className="relative overflow-hidden rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm"
                    >
                      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-destructive/15 via-transparent to-transparent blur-2xl" aria-hidden />
                      <div className="relative flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Betroffen: {entry.affectedNames.join(", ")}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-3 py-0.5 text-xs",
                            ALLERGY_LEVEL_STYLES[entry.highestLevel]?.badge ??
                              "border-border/60 bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {ALLERGY_LEVEL_LABELS[entry.highestLevel]}
                        </Badge>
                      </div>
                      <div className="relative mt-3 flex flex-wrap gap-2">{levelBadges}</div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="space-y-3 pb-0">
              <div className="flex items-center gap-2 text-primary">
                <UserCheck className="h-5 w-5" />
                <CardTitle className="text-base font-semibold">Priorisierte Profile</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Mitglieder mit strikten Ernährungsangaben oder hohen Allergiestufen – ideal für individuelles Briefing und Testverkostungen.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {priorityProfiles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                  Keine kritischen Profile hervorgehoben.
                </p>
              ) : (
                <ul className="space-y-3">
                  {priorityProfiles.map((profile) => {
                    const remaining = profile.restrictions.length - 3;
                    return (
                      <li
                        key={profile.userId}
                        className="relative overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 shadow-sm"
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />
                        <div className="relative flex items-start justify-between gap-3">
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
                        <div className="relative mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          {profile.restrictions.slice(0, 3).map((restriction, index) => (
                            <Badge
                              key={`${profile.userId}-${restriction.allergen}-${index}`}
                              variant="outline"
                              size="sm"
                              className="border-border/40 bg-background/90"
                            >
                              {restriction.allergen} · {ALLERGY_LEVEL_LABELS[restriction.level]}
                            </Badge>
                          ))}
                          {remaining > 0 ? (
                            <Badge variant="ghost" size="sm" className="border-border/30 bg-background/70 text-muted-foreground">
                              +{remaining} weitere
                            </Badge>
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
