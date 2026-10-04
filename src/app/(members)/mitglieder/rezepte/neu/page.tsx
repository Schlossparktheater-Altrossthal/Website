import { RecipeForm } from "@/components/food/recipes/recipe-form";
import { PageHeader } from "@/components/members/page-header";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function NewRecipePage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Neues Rezept"
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/rezepte"),
          { label: "Neues Rezept", isCurrent: true },
        ]}
      />
      <RecipeForm recipeId={null} initial={null} />
    </div>
  );
}
