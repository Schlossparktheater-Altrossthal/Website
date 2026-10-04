import { FoodDataAttribution } from "@/components/food/food-data-attribution";
import { RecipeList } from "@/components/food/recipes/recipe-list";
import { PageHeader } from "@/components/members/page-header";
import { listRecipes } from "@/lib/food/recipes/queries";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function RecipesPage() {
  await requireAuth();
  const recipes = await listRecipes();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rezepte"
        description="Gemeinsame Rezeptsammlung. Allergene und Nährwerte werden aus den Zutaten berechnet."
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/rezepte")]}
      />
      <RecipeList recipes={recipes} />
      <FoodDataAttribution />
    </div>
  );
}
