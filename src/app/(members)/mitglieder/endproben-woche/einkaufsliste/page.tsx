import Link from "next/link";
import { ChefHat, Grid3x3, ListChecks, Share2, type LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
import { ShoppingListBoard } from "@/components/members/shopping-list-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { buildShoppingList } from "@/lib/meal-planning/shopping-list";
import type { PlannerAssignments } from "@/lib/meal-planning/types";
import {
  DISH_LIBRARY,
  MEAL_SLOTS,
  STYLE_BADGE_VARIANTS,
  loadMealPlanningContext,
} from "../essenplanung/meal-plan-context";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

const DEFAULT_CATEGORY_LABEL = "Sonstiges";

type Metric = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
};

function formatCategoryLabel(value?: string | null) {
  if (!value) return DEFAULT_CATEGORY_LABEL;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_CATEGORY_LABEL;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export const dynamic = "force-dynamic";

export default async function EinkaufslistePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.essenplanung");
  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
          Kein Zugriff auf die Einkaufsliste.
        </div>
      </div>
    );
  }

  const { plannerDays, defaultParticipantCount, totalParticipants } = await loadMealPlanningContext(
    session.user?.id,
  );
  const assignments: PlannerAssignments = {};
  const uniqueDishIds = new Set<string>();
  let filledSlots = 0;
  for (const day of plannerDays) {
    const dayAssignments: Record<string, string | null | undefined> = {};
    for (const slot of day.slots) {
      if (slot.dishId) {
        dayAssignments[slot.slot] = slot.dishId;
        uniqueDishIds.add(slot.dishId);
        filledSlots += 1;
      }
    }
    assignments[day.key] = dayAssignments;
  }

  const shoppingList = buildShoppingList({
    assignments,
    recipes: DISH_LIBRARY,
    participantCount: defaultParticipantCount,
  });
  const hasGeneratedItems = shoppingList.length > 0;
  const categoryCount = new Set(
    shoppingList.map((item) => formatCategoryLabel(item.category)),
  ).size;
  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/endproben-woche/einkaufsliste"),
  ];
  const numberFormatter = new Intl.NumberFormat("de-DE");
  const metrics: Metric[] = [
    {
      label: "Menüs fixiert",
      value: numberFormatter.format(uniqueDishIds.size),
      hint: `${numberFormatter.format(filledSlots)} Slots gefüllt`,
      icon: ChefHat,
      accent: "border-primary/40 bg-primary/10 text-primary ring-primary/20",
    },
    {
      label: "Artikel in Arbeit",
      value: numberFormatter.format(shoppingList.length),
      hint: hasGeneratedItems ? "Automatisch aggregiert" : "Wartet auf Rezepte",
      icon: ListChecks,
      accent: "border-sky-400/40 bg-sky-500/10 text-sky-500 ring-sky-500/20",
    },
    {
      label: "Kategorien",
      value: numberFormatter.format(categoryCount),
      hint: categoryCount > 0 ? "Strukturierte Einkaufspfade" : "Noch keine Zuordnung",
      icon: Grid3x3,
      accent: "border-emerald-400/40 bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einkaufsliste"
        description="Die automatisch aggregierten Mengen aus der Essensplanung – inklusive eigener Ergänzungen und optionalem Sharing-Link."
        breadcrumbs={breadcrumbs}
        quickActions={
          hasGeneratedItems ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Share2 className="h-4 w-4" />
              <span>{shoppingList.length} Artikel · {totalParticipants} versorgte Personen</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ChefHat className="h-4 w-4" />
              <span>Noch keine Rezepte fixiert – starte in der Essensplanung.</span>
            </div>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)] lg:items-start 2xl:gap-8">
        <div className="space-y-6">
          <Card className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/95 shadow-[0_24px_65px_rgba(59,130,246,0.14)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -right-12 bottom-4 h-32 w-32 rounded-full bg-sky-500/15 blur-3xl" />
            </div>
            <CardHeader className="relative space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Share2 className="h-5 w-5" />
                <CardTitle className="text-base font-semibold">Planungsüberblick</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Die Kennzahlen beziehen sich auf die aktuell hinterlegten Menüs und aggregierten Zutatenmengen. Aktualisiere die Essensplanung, um den Überblick in Echtzeit anzupassen.
              </p>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm ring-4 ring-transparent transition hover:border-primary/40 hover:ring-primary/10"
                    >
                      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/5 blur-2xl" aria-hidden />
                      <div className="relative flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border text-primary ring-4 ${metric.accent}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {metric.label}
                          </p>
                          <p className="text-xl font-semibold text-foreground">{metric.value}</p>
                          <p className="text-xs text-muted-foreground">{metric.hint}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          {!hasGeneratedItems ? (
            <Card className="rounded-3xl border border-dashed border-border/60 bg-background/80">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <ChefHat className="h-5 w-5" />
                  <CardTitle className="text-base font-semibold text-primary">Noch keine Einkaufsliste verfügbar</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Aktuell wurden noch keine Menüs für die Endprobenwoche festgelegt. Sobald du in der Essensplanung konkrete
                  Gerichte fixierst, erzeugen wir automatisch eine gebündelte Einkaufsliste.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Den Zeitraum der Endprobenwoche definierst du direkt bei der Produktionserstellung im Bereich{' '}
                  <Link
                    href="/mitglieder/produktionen"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    „Produktionen“
                  </Link>
                  .
                </p>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href="/mitglieder/endproben-woche/essenplanung">Essensplanung öffnen</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <ShoppingListBoard initialItems={shoppingList} />
        </div>
        <div className="space-y-6 lg:sticky lg:top-24">
          <Card className="rounded-3xl border border-border/60 bg-background/80">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Hinweis zu Kategorien</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Die Kategorien basieren auf den Angaben der Rezepte. Eigene Ergänzungen kannst du frei einsortieren oder ohne Eingabe automatisch unter
                <span className="font-medium text-foreground"> Sonstiges</span> ablegen.
              </p>
              <div className="flex flex-wrap gap-2">
                {MEAL_SLOTS.map((slot) => (
                  <span
                    key={slot}
                    className="rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {slot}
                  </span>
                ))}
              </div>
              <p>
                Die Badges orientieren sich an den Ernährungsstilen aus der Planung. Neue Rezepte nutzen die gleichen Varianten wie im Meal-Plan.
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STYLE_BADGE_VARIANTS).map(([style, className]) => (
                  <span
                    key={style}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${className}`}
                  >
                    {style}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
