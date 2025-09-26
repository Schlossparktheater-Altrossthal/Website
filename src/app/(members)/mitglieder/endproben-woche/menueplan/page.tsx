import Link from "next/link";
import {
  CalendarDays,
  ChefHat,
  Coffee,
  NotebookPen,
  ShieldAlert,
  Sparkles,
  UtensilsCrossed,
  Moon,
  type LucideIcon,
} from "lucide-react";
import type { AllergyLevel } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  STYLE_BADGE_VARIANTS,
  STYLE_LABELS,
  loadMealPlanningContext,
} from "../essenplanung/meal-plan-context";
import { cn } from "@/lib/utils";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

const SLOT_ICONS: Record<string, LucideIcon> = {
  Frühstück: Coffee,
  Mittag: UtensilsCrossed,
  Abendbrot: Moon,
};

const ALLERGY_LEVEL_LABELS: Record<AllergyLevel, string> = {
  MILD: "Leicht",
  MODERATE: "Mittel",
  SEVERE: "Stark",
  LETHAL: "Kritisch",
};

export const dynamic = "force-dynamic";

export default async function MenueplanPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.essenplanung");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
        Kein Zugriff auf den Menüplan.
      </div>
    );
  }

  const {
    show,
    mealPlan,
    totalParticipants,
    defaultParticipantCount,
    styleSummaries,
    allergenSummaries,
  } = await loadMealPlanningContext(session.user?.id);

  const finalWeekStart = show?.finalRehearsalWeekStart ?? null;
  const finalWeekEnd = finalWeekStart ? new Date(finalWeekStart.getTime() + 6 * 86_400_000) : null;
  const finalWeekRangeLabel = finalWeekStart && finalWeekEnd
    ? `${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(finalWeekStart)} – ${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(finalWeekEnd)}`
    : null;
  const finalWeekStartLabel = finalWeekStart
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(finalWeekStart)
    : null;
  const numberFormatter = new Intl.NumberFormat("de-DE");
  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/endproben-woche/menueplan")].filter(
    Boolean,
  );

  const topStyleSummaries = styleSummaries.slice(0, 4);
  const topAllergens = allergenSummaries.slice(0, 5);

  return (
    <div className="space-y-8 xl:space-y-10">
      <PageHeader
        title="Menüplan"
        description="Frühstück, Mittag und Abendbrot der Endprobenwoche im Überblick – inklusive Fokus-Stilen, Highlights und kritischen Hinweisen."
        breadcrumbs={breadcrumbs}
        quickActions={
          <div className="flex flex-wrap items-center gap-2">
            {finalWeekRangeLabel ? (
              <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{finalWeekRangeLabel}</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-warning/60 bg-warning/10 text-warning">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Zeitraum festlegen</span>
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 border-border/60 bg-background/90 text-muted-foreground">
              <ChefHat className="h-3.5 w-3.5" />
              <span>{numberFormatter.format(totalParticipants)} Profile</span>
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:items-start">
        <div className="space-y-6">
          <Card className="border border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <CardTitle className="text-base font-semibold">Planung & Übergänge</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Änderungen in der Essensplanung aktualisieren den Menüplan und die Einkaufslisten automatisch.
                Nutze die Buttons, um direkt zwischen den Bereichen zu wechseln.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="gap-2">
                  <Link href="/mitglieder/endproben-woche/essenplanung">
                    <NotebookPen className="h-4 w-4" /> Essensplanung anpassen
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/mitglieder/endproben-woche/einkaufsliste">
                    <Sparkles className="h-4 w-4" /> Einkaufslisten öffnen
                  </Link>
                </Button>
                {finalWeekStartLabel ? (
                  <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Start {finalWeekStartLabel}</span>
                  </Badge>
                ) : null}
                <Badge variant="outline" className="gap-1 border-border/60 bg-background/90 text-muted-foreground">
                  <ChefHat className="h-3.5 w-3.5" />
                  <span>Basis: {numberFormatter.format(defaultParticipantCount)} Portionen</span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          {mealPlan.map((day) => (
            <Card
              key={day.key}
              className="relative overflow-hidden border border-border/70 bg-background/95 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-16 top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
                <div className="absolute -right-12 bottom-8 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
              </div>
              <CardHeader className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">{day.label}</CardTitle>
                  {day.date ? (
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(day.date)}
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {day.entries.length} Slots geplant
                </Badge>
              </CardHeader>
              <CardContent className="relative space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {day.entries.map((entry) => {
                    const SlotIcon = SLOT_ICONS[entry.slot] ?? ChefHat;
                    const suitableLabels = Array.from(
                      new Set(entry.dish.suitableFor.map((style) => STYLE_LABELS[style] ?? style)),
                    );
                    return (
                      <div
                        key={`${day.key}-${entry.slot}`}
                        className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-background/98 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="rounded-full border border-primary/40 bg-primary/10 p-2 text-primary">
                              <SlotIcon className="h-4 w-4" />
                            </span>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{entry.slot}</p>
                              <p className="text-sm font-semibold text-foreground">{entry.dish.title}</p>
                              <p className="text-xs text-muted-foreground">{entry.dish.description}</p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "whitespace-nowrap text-[11px]",
                              STYLE_BADGE_VARIANTS[entry.focusStyle],
                            )}
                          >
                            {entry.focusLabel}
                          </Badge>
                        </div>
                        {entry.dish.highlights.length ? (
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            {entry.dish.highlights.map((highlight) => (
                              <span
                                key={highlight}
                                className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5 uppercase tracking-wide"
                              >
                                {highlight}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          Geeignet für {suitableLabels.join(", ")} · Grundmenge für {numberFormatter.format(entry.dish.servings)} Portionen.
                        </p>
                        {entry.dish.avoids.length ? (
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">Vermeidet:</span>
                            {entry.dish.avoids.map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {entry.cautionMatches.length ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/60 bg-warning/10 p-3 text-xs text-warning">
                            <ShieldAlert className="h-4 w-4" />
                            <span>
                              Achtung bei: {entry.cautionMatches.join(", ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="border border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="space-y-3 pb-0">
              <div className="flex items-center gap-2 text-primary">
                <ChefHat className="h-5 w-5" />
                <CardTitle className="text-base font-semibold">Ernährungscluster</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Dominante Präferenzen der gemeldeten Profile. Nutze sie für Buffet-Linien, Testverkostungen und Tagesfoki.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {topStyleSummaries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                  Noch keine Angaben vorhanden.
                </p>
              ) : (
                topStyleSummaries.map((summary) => (
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
                Kritische Allergene mit betroffenen Personen und Schweregrad – ideal für Kennzeichnungen und Stationsplanung.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {topAllergens.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                  Keine aktiven Allergiehinweise.
                </p>
              ) : (
                topAllergens.map((entry) => {
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
                      <div className="relative flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Betroffene: {entry.affectedNames.join(", ")}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                            {ALLERGY_LEVEL_LABELS[entry.highestLevel]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">{levelBadges}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
