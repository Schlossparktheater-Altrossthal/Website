"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";

import type { DietaryStyleOption } from "@/data/dietary-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildShoppingList } from "@/lib/meal-planning/shopping-list";
import type { PlannerAssignments, PlannerDay, PlannerRecipe } from "@/lib/meal-planning/types";
import { cn } from "@/lib/utils";

type MealPlanRecipeWorkbenchProps = {
  library: PlannerRecipe[];
  days: PlannerDay[];
  defaultParticipants: number;
  mealSlots: readonly string[];
  styleBadgeVariants: Record<DietaryStyleOption, string>;
};

type IngredientDraft = {
  name: string;
  amount: string;
  unit: string;
};

type RecipeDraft = {
  title: string;
  description: string;
  servings: string;
  slot: string;
  ingredients: IngredientDraft[];
  instructions: string[];
};

export function MealPlanRecipeWorkbench({
  library,
  days,
  defaultParticipants,
  mealSlots,
  styleBadgeVariants,
}: MealPlanRecipeWorkbenchProps) {
  const [recipes, setRecipes] = useState<PlannerRecipe[]>(library);
  const [participantInput, setParticipantInput] = useState<string>(() =>
    String(Math.max(defaultParticipants, 1)),
  );
  const participantCount = useMemo(() => {
    const parsed = Number.parseInt(participantInput, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 1;
    }
    return parsed;
  }, [participantInput]);
  const [selectedRecipes, setSelectedRecipes] = useState<PlannerAssignments>(() => {
    const mapping: PlannerAssignments = {};
    for (const day of days) {
      const slotMap: Record<string, string | null | undefined> = {};
      for (const slot of day.slots) {
        if (slot.dishId) {
          slotMap[slot.slot] = slot.dishId;
        }
      }
      mapping[day.key] = slotMap;
    }
    return mapping;
  });
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newRecipe, setNewRecipe] = useState<RecipeDraft>(() => ({
    title: "",
    description: "",
    servings: "6",
    slot: mealSlots[0] ?? "Frühstück",
    ingredients: [{ name: "", amount: "", unit: "" }],
    instructions: [""],
  }));
  const [formError, setFormError] = useState<string | null>(null);

  const recipeMap = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]));
  }, [recipes]);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("de-DE", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }),
    [],
  );

  const shoppingList = useMemo(
    () =>
      buildShoppingList({
        assignments: selectedRecipes,
        recipes,
        participantCount,
      }),
    [participantCount, recipes, selectedRecipes],
  );

  const handleParticipantChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    setParticipantInput(sanitized);
  };

  const ensureParticipantMinimum = () => {
    if (!participantInput || participantInput === "0") {
      setParticipantInput("1");
    }
  };

  const handleRecipeSelect = (dayKey: string, slotLabel: string, recipeId: string) => {
    setSelectedRecipes((prev) => {
      const next: PlannerAssignments = {};
      for (const day of days) {
        const slotAssignments: PlannerAssignments[string] = {};
        const previous = prev[day.key];
        if (previous) {
          Object.assign(slotAssignments, previous);
        }
        next[day.key] = slotAssignments;
      }
      next[dayKey][slotLabel] = recipeId;
      return next;
    });
  };

  const addIngredientRow = () => {
    setNewRecipe((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "", amount: "", unit: "" }],
    }));
  };

  const updateIngredientRow = (index: number, field: keyof IngredientDraft, value: string) => {
    setNewRecipe((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, current) =>
        current === index ? { ...ingredient, [field]: value } : ingredient,
      ),
    }));
  };

  const removeIngredientRow = (index: number) => {
    setNewRecipe((prev) => {
      if (prev.ingredients.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        ingredients: prev.ingredients.filter((_, current) => current !== index),
      };
    });
  };

  const addInstructionRow = () => {
    setNewRecipe((prev) => ({
      ...prev,
      instructions: [...prev.instructions, ""],
    }));
  };

  const updateInstructionRow = (index: number, value: string) => {
    setNewRecipe((prev) => ({
      ...prev,
      instructions: prev.instructions.map((instruction, current) =>
        current === index ? value : instruction,
      ),
    }));
  };

  const removeInstructionRow = (index: number) => {
    setNewRecipe((prev) => {
      if (prev.instructions.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        instructions: prev.instructions.filter((_, current) => current !== index),
      };
    });
  };

  const handleAddCustomRecipe = () => {
    const title = newRecipe.title.trim();
    if (!title) {
      setFormError("Bitte gib dem Rezept einen Titel.");
      return;
    }

    const servingsValue = Number.parseInt(newRecipe.servings, 10);
    const normalizedServings = Number.isNaN(servingsValue) || servingsValue <= 0 ? 1 : servingsValue;

    const parsedIngredients = newRecipe.ingredients
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        amount: Number.parseFloat(ingredient.amount.replace(",", ".")),
        unit: ingredient.unit.trim() || "Stk",
      }))
      .filter((ingredient) => ingredient.name && !Number.isNaN(ingredient.amount) && ingredient.amount > 0);

    if (parsedIngredients.length === 0) {
      setFormError("Mindestens eine gültige Zutat angeben.");
      return;
    }

    const parsedInstructions = newRecipe.instructions
      .map((instruction) => instruction.trim())
      .filter((instruction) => instruction.length > 0);

    if (parsedInstructions.length === 0) {
      setFormError("Mindestens einen Zubereitungsschritt angeben.");
      return;
    }

    const recipeId = `custom-${Date.now()}`;

    const recipe: PlannerRecipe = {
      id: recipeId,
      title,
      description: newRecipe.description.trim() || "Eigenes Rezept",
      suitableFor: ["custom"],
      highlights: ["individuell"],
      avoids: [],
      caution: [],
      servings: normalizedServings,
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      idealSlots: [newRecipe.slot],
    };

    setRecipes((prev) => [...prev, recipe]);
    setSelectedRecipes((prev) => {
      const next: PlannerAssignments = {};
      for (const day of days) {
        const slotAssignments: PlannerAssignments[string] = {};
        const previous = prev[day.key];
        if (previous) {
          Object.assign(slotAssignments, previous);
        }
        next[day.key] = slotAssignments;
      }
      const targetSlot = recipe.idealSlots?.[0];
      if (targetSlot) {
        for (const day of days) {
          if (day.slots.some((entry) => entry.slot === targetSlot)) {
            next[day.key][targetSlot] = recipe.id;
            break;
          }
        }
      }
      return next;
    });

    setNewRecipe({
      title: "",
      description: "",
      servings: newRecipe.servings,
      slot: newRecipe.slot,
      ingredients: [{ name: "", amount: "", unit: "" }],
      instructions: [""],
    });
    setFormError(null);
    setShowCustomForm(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border border-border/60 bg-background/80">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold">Rezeptplanung</CardTitle>
          <p className="text-sm text-muted-foreground">
            Wähle Vorschläge aus der Bibliothek oder ergänze eigene Rezepte pro Slot – die Mengen werden automatisch auf eure
            Gruppengröße skaliert.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xs space-y-1">
              <Label htmlFor="planner-participants">Personenanzahl</Label>
              <Input
                id="planner-participants"
                inputMode="numeric"
                min={1}
                value={participantInput}
                onChange={(event) => handleParticipantChange(event.target.value)}
                onBlur={ensureParticipantMinimum}
                placeholder="z. B. 24"
              />
              <p className="text-xs text-muted-foreground">
                Zutatenmengen werden auf diese Gruppengröße hochgerechnet.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowCustomForm((prev) => !prev)}>
                {showCustomForm ? "Formular schließen" : "Eigenes Rezept hinzufügen"}
              </Button>
            </div>
          </div>

          {showCustomForm ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/80 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="custom-title">Rezeptname</Label>
                  <Input
                    id="custom-title"
                    value={newRecipe.title}
                    onChange={(event) => setNewRecipe((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="z. B. Sonnendeck-Porridge"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-servings">Standardportionen</Label>
                  <Input
                    id="custom-servings"
                    inputMode="numeric"
                    min={1}
                    value={newRecipe.servings}
                    onChange={(event) =>
                      setNewRecipe((prev) => ({
                        ...prev,
                        servings: event.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    placeholder="6"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="custom-description">Kurzbeschreibung</Label>
                  <Textarea
                    id="custom-description"
                    value={newRecipe.description}
                    onChange={(event) =>
                      setNewRecipe((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Was macht das Rezept besonders?"
                    rows={3}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-slot">Bevorzugter Slot</Label>
                  <Select
                    value={newRecipe.slot}
                    onValueChange={(value) => setNewRecipe((prev) => ({ ...prev, slot: value }))}
                  >
                    <SelectTrigger id="custom-slot">
                      <SelectValue placeholder="Slot auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {mealSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Zutaten</Label>
                  <Button variant="ghost" size="sm" onClick={addIngredientRow}>
                    <Plus className="mr-2 h-4 w-4" /> Neue Zutat
                  </Button>
                </div>
                <div className="space-y-2">
                  {newRecipe.ingredients.map((ingredient, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-lg border border-border/60 bg-background/70 p-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,1fr)_auto]"
                    >
                      <Input
                        placeholder="Menge"
                        inputMode="decimal"
                        value={ingredient.amount}
                        onChange={(event) =>
                          updateIngredientRow(index, "amount", event.target.value.replace(/[^0-9.,]/g, ""))
                        }
                      />
                      <Input
                        placeholder="Einheit"
                        value={ingredient.unit}
                        onChange={(event) => updateIngredientRow(index, "unit", event.target.value)}
                      />
                      <Input
                        placeholder="Zutat"
                        value={ingredient.name}
                        onChange={(event) => updateIngredientRow(index, "name", event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        onClick={() => removeIngredientRow(index)}
                        disabled={newRecipe.ingredients.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Zubereitungsschritte</Label>
                  <Button variant="ghost" size="sm" onClick={addInstructionRow}>
                    <Plus className="mr-2 h-4 w-4" /> Neuer Schritt
                  </Button>
                </div>
                <div className="space-y-2">
                  {newRecipe.instructions.map((instruction, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Textarea
                        value={instruction}
                        onChange={(event) => updateInstructionRow(index, event.target.value)}
                        placeholder={`Schritt ${index + 1}`}
                        rows={2}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1 text-muted-foreground"
                        onClick={() => removeInstructionRow(index)}
                        disabled={newRecipe.instructions.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {formError ? (
                <p className="mt-4 text-sm text-destructive">{formError}</p>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowCustomForm(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleAddCustomRecipe}>Rezept speichern</Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {days.map((day) => (
              <div
                key={day.key}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{day.label}</div>
                    {day.dateLabel ? (
                      <div className="text-xs text-muted-foreground/80">{day.dateLabel}</div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3">
                  {day.slots.map((slot) => {
                    const selectedId = selectedRecipes[day.key]?.[slot.slot];
                    const matchingRecipes = recipes.filter(
                      (recipe) => !recipe.idealSlots || recipe.idealSlots.includes(slot.slot),
                    );
                    const fallbackRecipes = recipes.filter(
                      (recipe) => recipe.idealSlots && !recipe.idealSlots.includes(slot.slot),
                    );
                    const recipeOptions = [...matchingRecipes, ...fallbackRecipes];
                    const recipe = selectedId ? recipeMap.get(selectedId) : null;
                    const scaleFactor = recipe ? participantCount / (recipe.servings > 0 ? recipe.servings : 1) : 1;
                    return (
                      <div
                        key={`${day.key}-${slot.slot}`}
                        className="space-y-3 rounded-xl border border-border/60 bg-background/90 p-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{slot.slot}</div>
                            <div className="text-sm font-semibold text-foreground">
                              {recipe ? recipe.title : "Rezept auswählen"}
                            </div>
                            {recipe ? (
                              <p className="text-xs text-muted-foreground">{recipe.description}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Wähle ein Rezept, um Details und Mengen zu sehen.
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "self-start border-transparent text-[11px]",
                              styleBadgeVariants[slot.focusStyle] ?? "border-border/60 bg-muted/40 text-muted-foreground",
                            )}
                          >
                            {slot.focusLabel}
                          </Badge>
                        </div>
                        <Select
                          value={selectedId ?? undefined}
                          onValueChange={(value) => handleRecipeSelect(day.key, slot.slot, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Rezept auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {recipeOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {recipe ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                              {recipe.highlights.map((highlight) => (
                                <span
                                  key={`${recipe.id}-highlight-${highlight}`}
                                  className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary"
                                >
                                  {highlight}
                                </span>
                              ))}
                              {recipe.avoids.map((avoid) => (
                                <span
                                  key={`${recipe.id}-avoid-${avoid}`}
                                  className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-500"
                                >
                                  ohne {avoid}
                                </span>
                              ))}
                            </div>
                            {recipe.caution && recipe.caution.length ? (
                              <div className="flex flex-wrap gap-1.5 text-[11px] text-destructive">
                                {recipe.caution.map((entry) => (
                                  <span
                                    key={`${recipe.id}-caution-${entry}`}
                                    className="rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5"
                                  >
                                    Achtung: {entry}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Skalierte Zutaten
                              </div>
                              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {recipe.ingredients.map((ingredient) => {
                                  const scaledAmount = ingredient.amount * scaleFactor;
                                  const rounded = Math.round(scaledAmount * 100) / 100;
                                  return (
                                    <li key={`${recipe.id}-${ingredient.name}-${ingredient.unit}`}>
                                      <span className="font-medium text-foreground">
                                        {numberFormatter.format(rounded)} {ingredient.unit}
                                      </span>{" "}
                                      {ingredient.name}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Zubereitung
                              </div>
                              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                                {recipe.instructions.map((instruction, index) => (
                                  <li key={`${recipe.id}-instruction-${index}`}>{instruction}</li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        </CardContent>
      </Card>

      <Card className="border border-border/60 bg-background/80">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Einkaufsliste</CardTitle>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href="/mitglieder/endproben-woche/einkaufsliste">Zur detaillierten Liste</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Alle benötigten Zutaten der ausgewählten Rezepte – perfekt zum Teilen mit Einkaufsteams.
          </p>
        </CardHeader>
        <CardContent>
          {shoppingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bitte wähle mindestens ein Rezept, um automatisch eine Einkaufsliste zu erstellen.
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {shoppingList.map((entry) => {
                const rounded = Math.round(entry.amount * 100) / 100;
                return (
                  <li
                    key={`${entry.name}-${entry.unit}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/90 px-3 py-2"
                  >
                    <span>
                      <span className="font-semibold text-foreground">
                        {numberFormatter.format(rounded)} {entry.unit}
                      </span>{" "}
                      {entry.name}
                    </span>
                    {entry.category ? (
                      <Badge variant="outline" className="border-border/60 bg-background/70 text-[11px]">
                        {entry.category}
                      </Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
