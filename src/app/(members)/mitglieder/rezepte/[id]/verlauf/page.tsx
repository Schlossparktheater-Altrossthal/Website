import { notFound } from "next/navigation";

import { RestoreRevisionButton } from "@/components/food/recipes/restore-revision-button";
import { PageHeader } from "@/components/members/page-header";
import { Card } from "@/components/ui/card";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { listRecipeRevisions } from "@/lib/food/recipes/queries";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const DATE = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});

export default async function RecipeHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true, title: true, version: true, updatedAt: true },
  });
  if (!recipe) notFound();
  const revisions = await listRecipeRevisions(recipe.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verlauf"
        description="Frühere Stände dieses Rezepts. Wiederherstellen legt eine neue Version an – nichts geht verloren."
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/rezepte"),
          { label: recipe.title, href: `/mitglieder/rezepte/${recipe.id}` },
          { label: "Verlauf", isCurrent: true },
        ]}
      />
      <Card className="p-0">
        <ul className="divide-y divide-border">
          <li className="flex flex-wrap items-center gap-2 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Version {recipe.version} (aktuell)
              </p>
              <p className="text-xs text-muted-foreground">
                {DATE.format(recipe.updatedAt)} · {recipe.title}
              </p>
            </div>
          </li>
          {revisions.map((revision) => (
            <li key={revision.version} className="flex flex-wrap items-center gap-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Version {revision.version}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {DATE.format(new Date(revision.createdAt))}
                  {revision.editedBy ? ` · ${revision.editedBy.name}` : ""} · {revision.title} ·{" "}
                  {revision.ingredientCount} Zutaten
                </p>
              </div>
              <RestoreRevisionButton recipeId={recipe.id} version={revision.version} />
            </li>
          ))}
          {revisions.length === 0 ? (
            <li className="py-12 text-center text-sm text-muted-foreground">
              Noch keine früheren Stände.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
