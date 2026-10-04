"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ChefHatIcon, PlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMinutes, formatRating } from "@/lib/food/recipes/format";
import type { RecipeListItem } from "@/lib/food/recipes/queries";
import { cn } from "@/lib/utils";

type DietFilter = "all" | "vegan" | "vegetarian";

const DIET_FILTERS: { value: DietFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "vegan", label: "Vegan" },
];

const NO_ALLERGEN = "none";

export function RecipeList({ recipes }: { recipes: RecipeListItem[] }) {
  const [query, setQuery] = useState("");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [without, setWithout] = useState<string>(NO_ALLERGEN);

  const allergenOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const recipe of recipes)
      for (const allergen of recipe.allergens) map.set(allergen.code, allergen.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [recipes]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    return recipes.filter((recipe) => {
      if (
        needle &&
        !`${recipe.title} ${recipe.tags.join(" ")}`.toLocaleLowerCase("de-DE").includes(needle)
      ) {
        return false;
      }
      if (diet !== "all" && recipe.diets?.[diet] !== "ok") return false;
      if (
        without !== NO_ALLERGEN &&
        recipe.allergens.some((allergen) => allergen.code === without)
      ) {
        return false;
      }
      return true;
    });
  }, [recipes, query, diet, without]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rezept oder Stichwort suchen"
            aria-label="Rezepte durchsuchen"
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button asChild>
            <Link href="/mitglieder/rezepte/neu">
              <PlusIcon />
              Neues Rezept
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Ernährungsform" className="flex flex-wrap gap-1">
          {DIET_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={diet === option.value}
              onClick={() => setDiet(option.value)}
              className={cn(
                "h-9 rounded-full border px-3 text-sm transition-colors",
                diet === option.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {allergenOptions.length > 0 ? (
          <Select value={without} onValueChange={setWithout}>
            <SelectTrigger className="h-9 w-auto min-w-44" aria-label="Ohne Allergen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ALLERGEN}>Alle Allergene</SelectItem>
              {allergenOptions.map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  ohne {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="py-12 text-center text-sm text-muted-foreground">
            {recipes.length === 0
              ? "Noch keine Rezepte – leg das erste an oder importiere eins von einer Webseite."
              : "Kein Rezept passt zu den Filtern."}
          </p>
        </Card>
      ) : (
        <ListRowGroup>
          {filtered.map((recipe) => (
            <ListRow
              key={recipe.id}
              href={`/mitglieder/rezepte/${recipe.id}`}
              leading={
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ChefHatIcon className="h-5 w-5" />
                </span>
              }
              title={<span className="break-words">{recipe.title}</span>}
              description={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {[
                    `${recipe.servings} Portionen`,
                    formatMinutes(recipe.totalMinutes),
                    formatRating(recipe.ratingAverage, recipe.ratingCount),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {recipe.diets?.vegan === "ok" ? (
                    <Badge variant="success" size="sm">
                      vegan
                    </Badge>
                  ) : recipe.diets?.vegetarian === "ok" ? (
                    <Badge variant="success" size="sm">
                      vegetarisch
                    </Badge>
                  ) : null}
                  {recipe.allergens.length > 0 ? (
                    <span className="text-xs">
                      enthält{" "}
                      {recipe.allergens
                        .slice(0, 3)
                        .map((allergen) => allergen.name)
                        .join(", ")}
                      {recipe.allergens.length > 3 ? ` +${recipe.allergens.length - 3}` : ""}
                    </span>
                  ) : null}
                </span>
              }
            />
          ))}
        </ListRowGroup>
      )}
    </div>
  );
}
