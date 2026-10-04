import { notFound } from "next/navigation";

import { RecipeForm } from "@/components/food/recipes/recipe-form";
import { PageHeader } from "@/components/members/page-header";
import { recipeToInput } from "@/lib/food/recipes/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true } });
  if (!recipe) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rezept bearbeiten"
        description="Jede Änderung wird mit dem vorherigen Stand im Verlauf gesichert."
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/rezepte"),
          { label: recipe.title, href: `/mitglieder/rezepte/${recipe.id}` },
          { label: "Bearbeiten", isCurrent: true },
        ]}
      />
      <RecipeForm recipeId={recipe.id} initial={recipeToInput(recipe)} />
    </div>
  );
}
