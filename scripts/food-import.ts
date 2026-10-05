// Datenimport Lebensmittel-Standard (docs/Plan/lebensmittel-standard-plan.md).
//
//   DATABASE_URL=… pnpm food:import taxonomy [--dir <ordner>]
//       Open-Food-Facts-Taxonomie (ODbL) + eigene Ergänzungen. Ohne --dir wird heruntergeladen;
//       mit --dir werden ingredients.json, allergens.json, ingredients.txt, allergens.txt gelesen.
//
//   DATABASE_URL=… pnpm food:import bls <ordner>
//       BLS 4.0 (CC BY 4.0). Ordner = entpacktes ZIP von https://www.blsdb.de/download mit
//       BLS_4_0_Components_DE_EN.xlsx und BLS_4_0_Daten_2025_DE.xlsx. Taxonomie zuerst importieren.
//
//   DATABASE_URL=… pnpm food:import link-restrictions [--apply] [--csv <datei>]
//       Verknüpft Allergie-Freitexte ohne Code mit der Taxonomie. Ohne --apply nur Bericht.
//       Sichere Treffer werden mit --apply gesetzt, Vorschläge nur berichtet (Migration von Hand).
//
//   DATABASE_URL=… pnpm food:import rematch-recipes
//       Ordnet automatisch zugeordnete Rezeptzutaten neu zu. Läuft nach taxonomy und bls von selbst.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { saveBlsComponents, saveBlsFoods } from "@/lib/food/items";
import { BLS_VERSION, readBlsComponents, readBlsFoods } from "@/lib/food/bls/parse";
import { rematchRecipes } from "@/lib/food/recipes/service";
import { linkRestrictionText } from "@/lib/food/restriction-link";
import { importOffTaxonomy } from "@/lib/food/taxonomy/import";
import { loadTaxonIndex } from "@/lib/food/taxonomy/store";
import { prisma } from "@/lib/prisma";

function option(args: string[], name: string): string | undefined {
  const position = args.indexOf(name);
  return position >= 0 ? args[position + 1] : undefined;
}

async function taxonomy(args: string[]) {
  const result = await importOffTaxonomy({ directory: option(args, "--dir") });
  process.stdout.write(
    `Taxonomie ${result.version}: ${result.taxa} Einträge, ${result.aliases} feste Aliase.\n`,
  );
}

async function bls(args: string[]) {
  const directory = args[0];
  if (!directory) throw new Error("Ordner mit den BLS-Dateien angeben.");
  if ((await prisma.foodTaxon.count()) === 0) {
    throw new Error("Taxonomie fehlt – zuerst `pnpm food:import taxonomy` ausführen.");
  }
  const components = await readBlsComponents(join(directory, "BLS_4_0_Components_DE_EN.xlsx"));
  await saveBlsComponents(components);
  const foods = await readBlsFoods(join(directory, "BLS_4_0_Daten_2025_DE.xlsx"));
  const stats = await saveBlsFoods(foods);
  await prisma.foodDataImport.create({
    data: {
      source: "bls",
      version: BLS_VERSION,
      itemCount: foods.length,
      note: `sicher ${stats.MATCHED}, teilweise ${stats.PARTIAL}, ungeklärt ${stats.UNCLEAR}`,
    },
  });
  process.stdout.write(
    `BLS ${BLS_VERSION}: ${components.length} Nährstoffe, ${foods.length} Lebensmittel ` +
      `(sicher ${stats.MATCHED}, teilweise ${stats.PARTIAL}, ungeklärt ${stats.UNCLEAR}).\n`,
  );
}

async function rematch() {
  const result = await rematchRecipes();
  process.stdout.write(
    `Rezepte neu zugeordnet: ${result.recipes} Rezepte, ${result.changed} Zutaten geändert.\n`,
  );
}

async function linkRestrictions(args: string[]) {
  const apply = args.includes("--apply");
  const csvPath = option(args, "--csv");
  const index = await loadTaxonIndex({ fresh: true });
  const open = await prisma.dietaryRestriction.findMany({
    where: { taxonCode: null },
    select: { id: true, allergen: true },
  });

  const rows: string[] = ["id;text;ergebnis;codes"];
  const counts = { sure: 0, suggestion: 0, none: 0 };
  for (const restriction of open) {
    const link = linkRestrictionText(index, restriction.allergen);
    counts[link.kind] += 1;
    const codes =
      link.kind === "sure"
        ? link.taxonCode
        : link.kind === "suggestion"
          ? link.taxonCodes.join(" ")
          : "";
    rows.push([restriction.id, JSON.stringify(restriction.allergen), link.kind, codes].join(";"));
    if (apply && link.kind === "sure") {
      await prisma.dietaryRestriction.update({
        where: { id: restriction.id },
        data: { taxonCode: link.taxonCode },
      });
    }
  }
  if (csvPath) await writeFile(csvPath, rows.join("\n") + "\n", "utf8");
  process.stdout.write(
    `${open.length} Einträge ohne Code: sicher ${counts.sure}${apply ? " (gesetzt)" : ""}, ` +
      `Vorschlag ${counts.suggestion}, ohne Treffer ${counts.none}.\n`,
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "taxonomy":
      await taxonomy(args);
      return rematch();
    case "bls":
      await bls(args);
      return rematch();
    case "rematch-recipes":
      return rematch();
    case "link-restrictions":
      return linkRestrictions(args);
    default:
      throw new Error(
        "Befehl: taxonomy | bls <ordner> | rematch-recipes | link-restrictions [--apply] [--csv <datei>]",
      );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
