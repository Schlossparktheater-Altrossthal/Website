export type PlannerIngredient = {
  name: string;
  amount: number;
  unit: string;
  category?: string;
};

import type { DietaryStyleOption } from "@/data/dietary-preferences";

export type PlannerRecipe = {
  id: string;
  title: string;
  description: string;
  suitableFor: DietaryStyleOption[];
  highlights: string[];
  avoids: string[];
  caution?: string[];
  servings: number;
  ingredients: PlannerIngredient[];
  instructions: string[];
  idealSlots?: readonly string[];
};

export type PlannerSlot = {
  slot: string;
  focusLabel: string;
  focusStyle: DietaryStyleOption;
  dishId?: string | null;
};

export type PlannerDay = {
  key: string;
  label: string;
  dateLabel: string | null;
  slots: PlannerSlot[];
};

export type PlannerAssignments = Record<string, Record<string, string | null | undefined>>;
