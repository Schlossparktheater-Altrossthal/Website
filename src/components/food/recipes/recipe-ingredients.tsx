"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignIngredientFoodAction,
  searchFoodItemsAction,
  type FoodItemOption,
} from "@/app/(members)/mitglieder/rezepte/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/food/recipes/format";
import type { RecipeDetail } from "@/lib/food/recipes/queries";

type Ingredient = RecipeDetail["ingredients"][number];

const SEARCH_DELAY_MS = 250;

/** Zutatenliste mit Portionen-Umschalter und Zuordnung von Hand (wird gelernt). */
export function RecipeIngredients({
  recipeId,
  servings,
  ingredients,
}: {
  recipeId: string;
  servings: number;
  ingredients: Ingredient[];
}) {
  const [portions, setPortions] = useState(servings);
  const [mapping, setMapping] = useState<Ingredient | null>(null);
  const factor = portions / servings;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Zutaten</h2>
        <div className="flex items-center gap-1" aria-label="Portionen">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9"
            aria-label="Weniger Portionen"
            disabled={portions <= 1}
            onClick={() => setPortions((value) => Math.max(1, value - 1))}
          >
            −
          </Button>
          <span className="min-w-24 text-center text-sm tabular-nums" aria-live="polite">
            {portions} Portionen
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9"
            aria-label="Mehr Portionen"
            onClick={() => setPortions((value) => Math.min(500, value + 1))}
          >
            +
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {ingredients.map((ingredient) => {
          const unresolved = ingredient.status === "UNCLEAR" || ingredient.status === "PARTIAL";
          const withoutNutrients = !ingredient.foodName;
          return (
            <li key={ingredient.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
              <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatAmount(ingredient.amount, ingredient.unit, factor)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-foreground">
                  {ingredient.name}
                  {ingredient.note ? (
                    <span className="text-muted-foreground">, {ingredient.note}</span>
                  ) : null}
                  {ingredient.optional ? (
                    <span className="text-muted-foreground"> (optional)</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ingredient.foodName ??
                    (ingredient.taxonNames.length > 0
                      ? ingredient.taxonNames.join(", ")
                      : "nicht zugeordnet")}
                </p>
              </div>
              {unresolved ? (
                <button
                  type="button"
                  onClick={() => setMapping(ingredient)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge variant="warning" size="sm">
                    {ingredient.status === "UNCLEAR" ? "zuordnen" : "unsicher – prüfen"}
                  </Badge>
                </button>
              ) : withoutNutrients ? (
                <button
                  type="button"
                  onClick={() => setMapping(ingredient)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge variant="muted" size="sm">
                    ohne Nährwerte
                  </Badge>
                </button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => setMapping(ingredient)}
                >
                  ändern
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <FoodItemDialog recipeId={recipeId} ingredient={mapping} onClose={() => setMapping(null)} />
    </div>
  );
}

function FoodItemDialog({
  recipeId,
  ingredient,
  onClose,
}: {
  recipeId: string;
  ingredient: Ingredient | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<FoodItemOption[]>([]);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (ingredient) setQuery(ingredient.name);
  }, [ingredient]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!ingredient || trimmed.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchFoodItemsAction(trimmed)
        .then((items) => {
          if (!cancelled) setOptions(items);
        })
        .catch((error: unknown) =>
          console.warn("[recipe] Lebensmittelsuche fehlgeschlagen", error),
        );
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, ingredient]);

  const pick = (option: FoodItemOption) => {
    if (!ingredient) return;
    startSave(async () => {
      const result = await assignIngredientFoodAction(recipeId, ingredient.id, option.id);
      if (!result.ok) {
        toast.error("Nicht gespeichert", { description: result.error, duration: 5000 });
        return;
      }
      toast.success(`„${ingredient.name}“ → ${option.name}`, {
        description: "Gleichnamige Zutaten werden künftig genauso zugeordnet.",
        duration: 3000,
      });
      onClose();
    });
  };

  return (
    <Dialog open={ingredient !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>„{ingredient?.name}“ zuordnen</DialogTitle>
          <DialogDescription>
            Wähle das passende Lebensmittel. Daraus kommen Allergene und Nährwerte.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Lebensmittel suchen"
          />
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => pick(option)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                >
                  <span className="min-w-0 break-words">{option.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{option.source}</span>
                </button>
              </li>
            ))}
            {query.trim().length >= 2 && options.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Nichts gefunden.</li>
            ) : null}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
