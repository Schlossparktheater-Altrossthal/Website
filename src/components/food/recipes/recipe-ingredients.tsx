"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignIngredientFoodAction,
  assignIngredientTaxaAction,
  confirmIngredientAction,
  ingredientOptionsAction,
  searchFoodOptionsAction,
} from "@/app/(members)/mitglieder/rezepte/actions";
import { CheckIcon, SearchIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/food/recipes/format";
import type { FoodOption, IngredientOptions } from "@/lib/food/recipes/ingredient-options";
import type { RecipeDetail } from "@/lib/food/recipes/queries";
import type { TaxonSuggestion } from "@/lib/food/taxon-suggestions";
import { cn } from "@/lib/utils";

type Ingredient = RecipeDetail["ingredients"][number];

const SEARCH_DELAY_MS = 250;

type LineState = "unclear" | "check" | "noNutrients" | "ok";

function lineState(ingredient: Ingredient): LineState {
  if (ingredient.status === "UNCLEAR") return "unclear";
  if (ingredient.status === "PARTIAL") return "check";
  if (!ingredient.foodName) return "noNutrients";
  return "ok";
}

const STATE_LABEL: Record<LineState, string> = {
  unclear: "zuordnen",
  check: "prüfen",
  noNutrients: "ohne Nährwerte",
  ok: "",
};

/** Zutatenliste mit Portionen-Umschalter; Antippen einer Zeile öffnet die Zuordnung. */
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
  const open = ingredients.filter((item) => item.status === "UNCLEAR" || item.status === "PARTIAL");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Zutaten</h2>
          {open.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {open.length === 1 ? "1 Zutat prüfen" : `${open.length} Zutaten prüfen`} – antippen
            </p>
          ) : null}
        </div>
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
      <ul className="-mx-2 divide-y divide-border">
        {ingredients.map((ingredient) => {
          const state = lineState(ingredient);
          const mappedTo =
            ingredient.foodName ??
            (ingredient.taxonNames.length > 0 ? ingredient.taxonNames.join(", ") : null);
          return (
            <li key={ingredient.id}>
              <button
                type="button"
                onClick={() => setMapping(ingredient)}
                className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="w-16 shrink-0 pt-px text-sm tabular-nums text-muted-foreground sm:w-20">
                  {formatAmount(ingredient.amount, ingredient.unit, factor)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm text-foreground">
                    {ingredient.name}
                    {ingredient.optional ? (
                      <span className="text-muted-foreground"> (optional)</span>
                    ) : null}
                  </span>
                  {ingredient.note ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {ingredient.note}
                    </span>
                  ) : null}
                  {mappedTo && state !== "unclear" ? (
                    <span className="block truncate text-xs text-muted-foreground/80">
                      → {mappedTo}
                    </span>
                  ) : null}
                </span>
                {state === "ok" ? (
                  <CheckIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    aria-label="zugeordnet"
                  />
                ) : (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      state === "noNutrients"
                        ? "bg-muted text-muted-foreground"
                        : "bg-warning/15 text-foreground",
                    )}
                  >
                    {STATE_LABEL[state]}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <IngredientSheet recipeId={recipeId} ingredient={mapping} onClose={() => setMapping(null)} />
    </div>
  );
}

function AllergenChips({ allergens }: { allergens: string[] }) {
  if (allergens.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {allergens.map((name) => (
        <span
          key={name}
          className="rounded-full bg-warning/15 px-1.5 py-px text-[11px] font-medium text-foreground"
        >
          {name}
        </span>
      ))}
    </span>
  );
}

function OptionButton({
  title,
  subtitle,
  allergens,
  disabled,
  onClick,
}: {
  title: string;
  subtitle?: string | null;
  /** `null`: unbekannt (Suchtreffer), dann keine Angabe statt „keine Hauptallergene“. */
  allergens: string[] | null;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border px-3 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
          {allergens ? <AllergenChips allergens={allergens} /> : null}
        </span>
      </span>
      <CheckIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Zuordnung einer Zutat: oben der jetzige Stand mit Allergenen („Passt so“), darunter
 * Lebensmittel (bringen Nährwerte) und reine Inhaltsstoffe, dazu eine Suche. Jede Wahl gilt
 * künftig auch für gleichnamige Zutaten.
 */
function IngredientSheet({
  recipeId,
  ingredient,
  onClose,
}: {
  recipeId: string;
  ingredient: Ingredient | null;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<IngredientOptions | null>(null);
  const [query, setQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodOption[]>([]);
  const [taxonResults, setTaxonResults] = useState<(TaxonSuggestion & { allergens: null })[]>([]);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (!ingredient) return;
    let cancelled = false;
    ingredientOptionsAction(recipeId, ingredient.id)
      .then((result) => {
        if (!cancelled && result.ok) setOptions(result.data);
      })
      .catch((error: unknown) => console.warn("[recipe] Vorschläge fehlgeschlagen", error));
    return () => {
      cancelled = true;
      setOptions(null);
      setQuery("");
    };
  }, [recipeId, ingredient]);

  const searching = query.trim().length >= 2;
  useEffect(() => {
    if (!searching) return;
    const trimmed = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchFoodOptionsAction(trimmed)
        .then((items) => !controller.signal.aborted && setFoodResults(items))
        .catch(() => undefined);
      fetch(`/api/food/taxa?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((data: { items?: TaxonSuggestion[] }) =>
          setTaxonResults(
            (data.items ?? []).slice(0, 5).map((item) => ({ ...item, allergens: null })),
          ),
        )
        .catch(() => undefined);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searching]);

  const done = (message: string) => {
    toast.success(message, {
      description: "Gleichnamige Zutaten werden künftig genauso zugeordnet.",
      duration: 3000,
    });
    onClose();
  };

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, message: string) =>
    startSave(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error("Nicht gespeichert", { description: result.error, duration: 5000 });
        return;
      }
      done(message);
    });

  if (!ingredient) return null;
  const name = ingredient.name;
  const foods = searching ? foodResults : (options?.foods ?? []);
  const taxa: (TaxonSuggestion & { allergens: string[] | null })[] = searching
    ? taxonResults
    : (options?.taxa ?? []);
  const current = options?.current;
  const currentLabel =
    current?.foodName ?? (current && current.taxa.length > 0 ? current.taxa.join(", ") : null);

  return (
    <BottomSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={name}
      description="Zutat einem Lebensmittel zuordnen"
      className="sm:max-w-lg"
    >
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground">„{ingredient.rawText}“</p>

        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <SectionLabel>Jetzt</SectionLabel>
          {current ? (
            <>
              <p className="text-sm font-medium text-foreground">
                {currentLabel ?? "Nicht erkannt"}
                {current.foodName === null && currentLabel ? (
                  <span className="font-normal text-muted-foreground"> · ohne Nährwerte</span>
                ) : null}
              </p>
              {currentLabel ? (
                current.allergens.length > 0 ? (
                  <div>
                    <AllergenChips allergens={current.allergens} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Keine Hauptallergene</p>
                )
              ) : null}
              {currentLabel && current.status !== "MANUAL" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    run(() => confirmIngredientAction(recipeId, ingredient.id), "Bestätigt")
                  }
                >
                  <CheckIcon />
                  Passt so
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Lädt…</p>
          )}
        </div>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Anderes suchen, z. B. Kürbis"
            aria-label="Lebensmittel suchen"
            className="pl-9"
          />
        </div>

        <div className="space-y-2">
          <SectionLabel hint="mit Nährwerten">Lebensmittel</SectionLabel>
          {foods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {options || searching ? "Nichts Passendes gefunden." : "Lädt…"}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {foods.map((food) => (
                <li key={food.id}>
                  <OptionButton
                    title={food.name}
                    subtitle={food.kcal !== null ? `${food.kcal} kcal / 100 g` : null}
                    allergens={food.allergens}
                    disabled={saving}
                    onClick={() =>
                      run(
                        () => assignIngredientFoodAction(recipeId, ingredient.id, food.id),
                        `„${name}“ → ${food.name}`,
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {taxa.length > 0 ? (
          <div className="space-y-2">
            <SectionLabel hint="nur Allergene, keine Nährwerte">Inhaltsstoff</SectionLabel>
            <ul className="space-y-1.5">
              {taxa.map((taxon) => (
                <li key={taxon.code}>
                  <OptionButton
                    title={taxon.name}
                    subtitle={taxon.path.length > 0 ? taxon.path.join(" › ") : null}
                    allergens={taxon.allergens}
                    disabled={saving}
                    onClick={() =>
                      run(
                        () => assignIngredientTaxaAction(recipeId, ingredient.id, [taxon.code]),
                        `„${name}“ → ${taxon.name}`,
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
