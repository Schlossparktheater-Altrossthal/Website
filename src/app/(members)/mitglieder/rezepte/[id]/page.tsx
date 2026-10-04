import Link from "next/link";
import { notFound } from "next/navigation";

import { FoodDataAttribution } from "@/components/food/food-data-attribution";
import { RecipeComments, RecipeRating } from "@/components/food/recipes/recipe-feedback";
import { RecipeIngredients } from "@/components/food/recipes/recipe-ingredients";
import { PageHeader } from "@/components/members/page-header";
import { EditIcon, ExternalLinkIcon, HistoryIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import {
  DIET_LABELS,
  NUTRIENT_ROWS,
  VERDICT_LABELS,
  formatMinutes,
  formatNutrient,
  formatRating,
  verdictTone,
  type DietKey,
} from "@/lib/food/recipes/format";
import { getRecipeDetail } from "@/lib/food/recipes/queries";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const DATE = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: DEFAULT_TIME_ZONE });

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await params;
  const recipe = await getRecipeDetail(id, session.user?.id ?? "");
  if (!recipe) notFound();

  const computed = recipe.computed;
  const meta = [
    formatMinutes(recipe.prepMinutes) && `Vorbereitung ${formatMinutes(recipe.prepMinutes)}`,
    formatMinutes(recipe.cookMinutes) && `Garzeit ${formatMinutes(recipe.cookMinutes)}`,
    formatRating(recipe.ratingAverage, recipe.ratingCount),
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title={recipe.title}
        description={recipe.description ?? undefined}
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/rezepte"),
          { label: recipe.title, isCurrent: true },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/mitglieder/rezepte/${recipe.id}/bearbeiten`}>
                <EditIcon />
                Bearbeiten
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/mitglieder/rezepte/${recipe.id}/verlauf`}>
                <HistoryIcon />
                Verlauf ({recipe.revisionCount})
              </Link>
            </Button>
          </div>
        }
      />

      {meta.length > 0 || recipe.tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {meta.length > 0 ? <span>{meta.join(" · ")}</span> : null}
          {recipe.tags.map((tag) => (
            <Badge key={tag} variant="muted" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card variant="plain" size="md">
          <RecipeIngredients
            recipeId={recipe.id}
            servings={recipe.servings}
            ingredients={recipe.ingredients}
          />
        </Card>
        <Card variant="plain" size="md" className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Zubereitung</h2>
          {recipe.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Schritte hinterlegt.</p>
          ) : (
            <ol className="space-y-3">
              {recipe.steps.map((step, position) => (
                <li key={position} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {position + 1}
                  </span>
                  <span className="min-w-0 break-words text-foreground">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card variant="plain" size="md" className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Allergene & Ernährungsformen</h2>
          {computed ? (
            <>
              {computed.status !== "MATCHED" && computed.status !== "MANUAL" ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                  Nicht alle Zutaten sind sicher zugeordnet
                  {computed.unclearIngredients.length > 0
                    ? ` (${computed.unclearIngredients.join(", ")})`
                    : ""}
                  . Angaben deshalb von Hand prüfen.
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Enthält
                </p>
                {computed.allergenLabels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine bekannten Allergene.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {computed.allergenLabels.map((allergen) => (
                      <Badge
                        key={allergen.code}
                        variant={allergen.lmiv ? "destructive" : "muted"}
                        size="sm"
                      >
                        {allergen.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {computed.traceLabels.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Kann Spuren enthalten:{" "}
                    {computed.traceLabels.map((item) => item.name).join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ernährungsformen
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DIET_LABELS) as DietKey[]).map((diet) => (
                    <Badge key={diet} variant={verdictTone(computed.diets[diet])} size="sm">
                      {DIET_LABELS[diet]}: {VERDICT_LABELS[computed.diets[diet]]}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Noch nicht ausgewertet.</p>
          )}
        </Card>

        <Card variant="plain" size="md" className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Nährwerte je Portion</h2>
          {computed && Object.keys(computed.perServing).length > 0 ? (
            <>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {NUTRIENT_ROWS.filter((row) => computed.perServing[row.code] !== undefined).map(
                    (row) => (
                      <tr key={row.code}>
                        <th
                          scope="row"
                          className={cn(
                            "py-1.5 text-left font-normal text-muted-foreground",
                            row.indent && "pl-4",
                          )}
                        >
                          {row.label}
                        </th>
                        <td className="py-1.5 text-right tabular-nums text-foreground">
                          {formatNutrient(computed.perServing[row.code])} {row.unit}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">
                Berechnet aus {Math.round(computed.nutritionCoverage * 100)} % der Zutaten (nur
                Zutaten mit bekannter Menge und zugeordnetem Lebensmittel).
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Nährwerte – dafür brauchen die Zutaten Mengen und eine Zuordnung.
            </p>
          )}
        </Card>
      </div>

      <Card variant="plain" size="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Bewertung & Kommentare</h2>
          <RecipeRating recipeId={recipe.id} myRating={recipe.myRating} />
        </div>
        <RecipeComments recipeId={recipe.id} comments={recipe.comments} />
      </Card>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Version {recipe.version}, zuletzt geändert {DATE.format(new Date(recipe.updatedAt))}
          {recipe.updatedBy ? ` von ${recipe.updatedBy.name}` : ""}
          {recipe.createdBy ? ` · angelegt von ${recipe.createdBy.name}` : ""}
        </p>
        {recipe.sourceUrl ? (
          <p>
            Quelle:{" "}
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            >
              {recipe.sourceName ?? new URL(recipe.sourceUrl).hostname}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </p>
        ) : null}
        <FoodDataAttribution />
      </div>
    </div>
  );
}
