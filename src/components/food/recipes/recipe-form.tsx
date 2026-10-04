"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveRecipeAction, importRecipeAction } from "@/app/(members)/mitglieder/rezepte/actions";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RecipeInput } from "@/lib/food/recipes/service";

type FormState = {
  title: string;
  description: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  tags: string;
  ingredients: string;
  steps: string;
  sourceUrl: string;
  sourceName: string;
};

function toFormState(input: RecipeInput | null): FormState {
  return {
    title: input?.title ?? "",
    description: input?.description ?? "",
    servings: String(input?.servings ?? 4),
    prepMinutes: input?.prepMinutes ? String(input.prepMinutes) : "",
    cookMinutes: input?.cookMinutes ? String(input.cookMinutes) : "",
    tags: input?.tags.join(", ") ?? "",
    ingredients: input?.ingredients.map((line) => line.rawText).join("\n") ?? "",
    steps: input?.steps.join("\n") ?? "",
    sourceUrl: input?.sourceUrl ?? "",
    sourceName: input?.sourceName ?? "",
  };
}

const optionalNumber = (value: string) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Anlegen und Bearbeiten eines Rezepts. Zutaten stehen je Zeile („200 g Mehl“); die Zuordnung zu
 * Lebensmitteln geschieht beim Speichern. Von Hand gesetzte Zuordnungen bleiben erhalten,
 * solange die Zeile unverändert ist.
 */
export function RecipeForm({
  recipeId,
  initial,
}: {
  recipeId: string | null;
  initial: RecipeInput | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => toFormState(initial));
  const [importUrl, setImportUrl] = useState("");
  const [importing, startImport] = useTransition();
  const [saving, startSave] = useTransition();

  const manualFoodByLine = useMemo(
    () =>
      new Map(
        (initial?.ingredients ?? [])
          .filter((line) => line.foodItemId)
          .map((line) => [line.rawText.trim(), line.foodItemId ?? null]),
      ),
    [initial],
  );

  const update = (field: keyof FormState) => (value: string) =>
    setState((previous) => ({ ...previous, [field]: value }));

  const handleImport = () =>
    startImport(async () => {
      const result = await importRecipeAction(importUrl.trim());
      if (!result.ok) {
        toast.error("Import fehlgeschlagen", { description: result.error, duration: 5000 });
        return;
      }
      const recipe = result.data;
      setState({
        title: recipe.title,
        description: recipe.description ?? "",
        servings: String(recipe.servings ?? 4),
        prepMinutes: recipe.prepMinutes ? String(recipe.prepMinutes) : "",
        cookMinutes: recipe.cookMinutes ? String(recipe.cookMinutes) : "",
        tags: recipe.tags.join(", "),
        ingredients: recipe.ingredientLines.join("\n"),
        steps: recipe.steps.join("\n"),
        sourceUrl: recipe.sourceUrl,
        sourceName: recipe.sourceName ?? "",
      });
      toast.success("Rezept übernommen – bitte prüfen und speichern.", { duration: 3000 });
    });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: RecipeInput = {
      title: state.title.trim(),
      description: state.description.trim() || null,
      servings: optionalNumber(state.servings) ?? 1,
      prepMinutes: optionalNumber(state.prepMinutes),
      cookMinutes: optionalNumber(state.cookMinutes),
      tags: state.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      steps: lines(state.steps),
      sourceUrl: state.sourceUrl.trim() || null,
      sourceName: state.sourceName.trim() || null,
      ingredients: lines(state.ingredients).map((rawText) => ({
        rawText,
        foodItemId: manualFoodByLine.get(rawText) ?? null,
      })),
    };
    startSave(async () => {
      const result = await saveRecipeAction(recipeId, input);
      if (!result.ok) {
        toast.error("Nicht gespeichert", { description: result.error, duration: 5000 });
        return;
      }
      toast.success("Rezept gespeichert", { duration: 3000 });
      router.push(`/mitglieder/rezepte/${result.data.id}`);
    });
  };

  return (
    <div className="space-y-6">
      {recipeId === null ? (
        <Card variant="plain" size="md" className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Von Webseite importieren</h2>
            <p className="text-xs text-muted-foreground">
              Fast alle Rezeptseiten liefern das Rezept maschinenlesbar mit. Bilder werden nicht
              übernommen, die Quelle bleibt verlinkt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="url"
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder="https://…"
              aria-label="Link zum Rezept"
              className="h-10 min-w-0 flex-1 basis-64"
            />
            <AsyncButton
              type="button"
              variant="outline"
              isLoading={importing}
              loadingText="Lädt…"
              disabled={importUrl.trim().length < 8}
              onClick={handleImport}
            >
              Importieren
            </AsyncButton>
          </div>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card variant="plain" size="md" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipe-title">Titel</Label>
            <Input
              id="recipe-title"
              required
              minLength={2}
              maxLength={160}
              value={state.title}
              onChange={(event) => update("title")(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-description">Beschreibung</Label>
            <Textarea
              id="recipe-description"
              rows={2}
              value={state.description}
              onChange={(event) => update("description")(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="recipe-servings">Portionen</Label>
              <Input
                id="recipe-servings"
                type="number"
                min={1}
                max={500}
                inputMode="numeric"
                value={state.servings}
                onChange={(event) => update("servings")(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-prep">Vorbereitung (Min.)</Label>
              <Input
                id="recipe-prep"
                type="number"
                min={0}
                inputMode="numeric"
                value={state.prepMinutes}
                onChange={(event) => update("prepMinutes")(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-cook">Kochen/Backen (Min.)</Label>
              <Input
                id="recipe-cook"
                type="number"
                min={0}
                inputMode="numeric"
                value={state.cookMinutes}
                onChange={(event) => update("cookMinutes")(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-tags">Stichworte</Label>
            <Input
              id="recipe-tags"
              value={state.tags}
              onChange={(event) => update("tags")(event.target.value)}
              placeholder="Eintopf, Großküche, schnell"
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card variant="plain" size="md" className="space-y-2">
            <Label htmlFor="recipe-ingredients">Zutaten – eine je Zeile</Label>
            <Textarea
              id="recipe-ingredients"
              required
              rows={12}
              value={state.ingredients}
              onChange={(event) => update("ingredients")(event.target.value)}
              placeholder={"500 g Kartoffeln\n1 Zwiebel\n2 EL Olivenöl\nSalz, nach Belieben"}
            />
            <p className="text-xs text-muted-foreground">
              Menge, Einheit, Zutat. Allergene und Nährwerte werden beim Speichern zugeordnet.
            </p>
          </Card>
          <Card variant="plain" size="md" className="space-y-2">
            <Label htmlFor="recipe-steps">Zubereitung – ein Schritt je Zeile</Label>
            <Textarea
              id="recipe-steps"
              rows={12}
              value={state.steps}
              onChange={(event) => update("steps")(event.target.value)}
            />
          </Card>
        </div>

        <Card variant="plain" size="md" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recipe-source-url">Quelle (Link)</Label>
            <Input
              id="recipe-source-url"
              type="url"
              value={state.sourceUrl}
              onChange={(event) => update("sourceUrl")(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-source-name">Quelle (Name)</Label>
            <Input
              id="recipe-source-name"
              value={state.sourceName}
              onChange={(event) => update("sourceName")(event.target.value)}
            />
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>
            Abbrechen
          </Button>
          <AsyncButton type="submit" isLoading={saving} loadingText="Speichern…">
            {recipeId ? "Änderung speichern" : "Rezept anlegen"}
          </AsyncButton>
        </div>
      </form>
    </div>
  );
}
