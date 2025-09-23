import type { PlannerAssignments, PlannerRecipe } from "./types";

export type ShoppingListEntry = {
  id: string;
  name: string;
  unit: string;
  amount: number;
  category?: string;
};

function createIngredientKey(ingredient: {
  name: string;
  unit: string;
  category?: string;
}) {
  const name = ingredient.name.trim().toLocaleLowerCase("de-DE");
  const unit = ingredient.unit.trim().toLocaleLowerCase("de-DE");
  const category = ingredient.category?.trim().toLocaleLowerCase("de-DE") ?? "";
  return `${name}__${unit}__${category}`;
}

export function buildShoppingList({
  assignments,
  recipes,
  participantCount,
}: {
  assignments: PlannerAssignments;
  recipes: PlannerRecipe[];
  participantCount: number;
}): ShoppingListEntry[] {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const totals = new Map<string, ShoppingListEntry>();

  for (const dayAssignments of Object.values(assignments)) {
    if (!dayAssignments) continue;
    for (const recipeId of Object.values(dayAssignments)) {
      if (!recipeId) continue;
      const recipe = recipeMap.get(recipeId);
      if (!recipe) continue;
      const servings = recipe.servings > 0 ? recipe.servings : 1;
      const scaleFactor = participantCount / servings;
      for (const ingredient of recipe.ingredients) {
        const key = createIngredientKey(ingredient);
        const existing = totals.get(key);
        const scaledAmount = ingredient.amount * scaleFactor;
        if (existing) {
          existing.amount += scaledAmount;
        } else {
          totals.set(key, {
            id: key,
            name: ingredient.name,
            unit: ingredient.unit,
            amount: scaledAmount,
            category: ingredient.category,
          });
        }
      }
    }
  }

  return Array.from(totals.values()).sort((a, b) => {
    const categoryA = a.category?.toLocaleLowerCase("de-DE") ?? "zzz";
    const categoryB = b.category?.toLocaleLowerCase("de-DE") ?? "zzz";
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB, "de-DE");
    }
    return a.name.localeCompare(b.name, "de-DE");
  });
}
