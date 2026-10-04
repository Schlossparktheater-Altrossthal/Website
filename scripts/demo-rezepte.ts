// Demo-Rezepte für lokales Testen und Screenshots (docs/Plan/ernaehrung-rezepte-ui-plan.md).
//
//   DATABASE_URL=… pnpm demo:rezepte [--email <nutzer>]   # anlegen bzw. neu anlegen
//   DATABASE_URL=… pnpm demo:rezepte --remove             # wieder entfernen
//
// Legt drei Rezepte an (eins davon mit einer Änderung im Verlauf, einer Bewertung und einem
// Kommentar). Alle Titel beginnen mit „Demo“. Nur für lokale/Test-DBs; die Taxonomie muss
// importiert sein (pnpm food:import).

import { commentRecipe, createRecipe, rateRecipe, updateRecipe } from "@/lib/food/recipes/service";
import { prisma } from "@/lib/prisma";

const RECIPES = [
  {
    title: "Demo Linsen-Dal für die Endprobenwoche",
    description: "Vegan, sättigend, gut für große Mengen.",
    servings: 8,
    prepMinutes: 15,
    cookMinutes: 35,
    tags: ["Eintopf", "Großküche"],
    steps: [
      "Zwiebel und Knoblauch fein hacken und im Öl glasig dünsten.",
      "Linsen, Kurkuma und Kokosmilch dazugeben, 25 Minuten köcheln.",
      "Mit Salz und Zitrone abschmecken.",
    ],
    ingredients: [
      "500 g rote Linsen",
      "2 Zwiebeln",
      "3 Zehen Knoblauch",
      "2 EL Olivenöl",
      "800 ml Kokosmilch",
      "2 TL Kurkuma",
      "1 Zitrone",
      "Salz, nach Belieben",
    ],
  },
  {
    title: "Demo Kartoffelgratin",
    description: "Klassiker mit Sahne und Käse.",
    servings: 6,
    prepMinutes: 20,
    cookMinutes: 50,
    tags: ["Ofen", "vegetarisch"],
    steps: [
      "Kartoffeln schälen und in Scheiben schneiden.",
      "Mit Sahne und Käse schichten und backen.",
    ],
    ingredients: [
      "1,5 kg Kartoffeln",
      "400 ml Sahne",
      "200 g Emmentaler",
      "1 Zehe Knoblauch",
      "Salz",
      "Muskat",
    ],
  },
  {
    title: "Demo Nusskuchen",
    servings: 12,
    prepMinutes: 20,
    cookMinutes: 60,
    tags: ["Kuchen"],
    steps: ["Alles verrühren.", "Bei 180 °C backen."],
    ingredients: [
      "250 g Butter",
      "200 g Zucker",
      "4 Eier",
      "200 g Haselnüsse (gemahlen)",
      "250 g Weizenmehl",
      "1 Pck. Backpulver",
    ],
  },
];

async function remove() {
  const { count } = await prisma.recipe.deleteMany({ where: { title: { startsWith: "Demo " } } });
  process.stdout.write(`${count} Demo-Rezepte entfernt.\n`);
}

async function create(email: string | undefined) {
  await remove();
  const user = email
    ? await prisma.user.findUniqueOrThrow({ where: { email } })
    : await prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const ids: string[] = [];
  for (const recipe of RECIPES) {
    const created = await createRecipe(
      {
        description: null,
        sourceUrl: null,
        sourceName: null,
        ...recipe,
        ingredients: recipe.ingredients.map((rawText) => ({ rawText })),
      },
      user.id,
    );
    ids.push(created.id);
  }
  const [dal] = RECIPES;
  await updateRecipe(
    ids[0],
    {
      ...dal,
      sourceUrl: null,
      sourceName: null,
      servings: 10,
      ingredients: [...dal.ingredients, "1 Bund Koriander"].map((rawText) => ({ rawText })),
    },
    user.id,
  );
  await rateRecipe(ids[0], user.id, 5);
  await commentRecipe(ids[0], user.id, "Mit Koriander noch besser – Reis dazu einplanen.");
  process.stdout.write(`${ids.length} Demo-Rezepte angelegt (für ${user.email}).\n`);
}

const args = process.argv.slice(2);
const emailIndex = args.indexOf("--email");
(args.includes("--remove") ? remove() : create(emailIndex >= 0 ? args[emailIndex + 1] : undefined))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
