import Link from "next/link";
import { ChefHat, Share2 } from "lucide-react";

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

export const dynamic = "force-dynamic";

export default async function EinkaufslistePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.essenplanung");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
        Kein Zugriff auf die Einkaufsliste.
      </div>
    );
  }

  const { plannerDays, defaultParticipantCount, totalParticipants } = await loadMealPlanningContext();
  const assignments: PlannerAssignments = {};
  for (const day of plannerDays) {
    const dayAssignments: Record<string, string | null | undefined> = {};
    for (const slot of day.slots) {
      if (slot.dishId) {
        dayAssignments[slot.slot] = slot.dishId;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einkaufsliste"
        description="Die automatisch aggregierten Mengen aus der Essensplanung – inklusive eigener Ergänzungen und optionalem Sharing-Link."
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)] xl:items-start">
        <div className="space-y-4">
          {!hasGeneratedItems ? (
            <Card className="border border-dashed border-border/60 bg-background/80">
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
        <div className="space-y-4">
          <Card className="border border-border/60 bg-background/80">
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
