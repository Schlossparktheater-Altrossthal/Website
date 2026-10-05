// Rezepte aus einer JSON-Datei anlegen (z. B. abgetippte Rezeptsammlungen).
//
//   DATABASE_URL=… pnpm tsx scripts/import-rezepte.ts --file rezepte.json --email <nutzer> [--source <Quelle>] [--dry-run]
//
// Rezepte mit gleichem Titel werden übersprungen, damit ein zweiter Lauf nichts doppelt anlegt.

import { readFileSync } from "node:fs";

import { createRecipe, recipeInputSchema } from "@/lib/food/recipes/service";
import { prisma } from "@/lib/prisma";

type FileRecipe = {
  title: string;
  description?: string | null;
  servings: number;
  tags?: string[];
  steps: string[];
  ingredients: string[];
  prepMinutes?: number | null;
  cookMinutes?: number | null;
};

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const file = arg("--file");
  const email = arg("--email");
  if (!file || !email) throw new Error("--file und --email angeben");
  const dryRun = process.argv.includes("--dry-run");
  const recipes = JSON.parse(readFileSync(file, "utf8")) as FileRecipe[];
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  let created = 0;
  for (const recipe of recipes) {
    const input = recipeInputSchema.parse({
      description: null,
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
      sourceUrl: null,
      sourceName: arg("--source") ?? null,
      ...recipe,
      ingredients: recipe.ingredients.map((rawText) => ({ rawText })),
    });
    const existing = await prisma.recipe.findFirst({
      where: { title: input.title, archivedAt: null },
    });
    if (existing) {
      process.stdout.write(`übersprungen (gibt es schon): ${input.title}\n`);
      continue;
    }
    if (dryRun) {
      process.stdout.write(`würde anlegen: ${input.title}\n`);
      continue;
    }
    const result = await createRecipe(input, user.id);
    const unclear = await prisma.recipeIngredient.count({
      where: { recipeId: result.id, status: "UNCLEAR" },
    });
    process.stdout.write(`angelegt: ${input.title} (${unclear} Zutaten unklar)\n`);
    created++;
  }
  process.stdout.write(`${created} Rezepte angelegt für ${user.email}.\n`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
