import { AlertTriangle, ChefHat, CheckCircle2, Sparkles } from "lucide-react";
import type { AllergyLevel } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { MealPlanRecipeWorkbench } from "@/components/members/meal-plan-recipe-workbench";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import { getUserDisplayName } from "@/lib/names";
import {
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
  resolveDietaryStrictnessLabel,
  resolveDietaryStyleLabel,
  type DietaryStrictnessOption,
  type DietaryStyleOption,
} from "@/data/dietary-preferences";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ALLERGY_LEVEL_LABELS: Record<AllergyLevel, string> = {
  MILD: "Leicht",
  MODERATE: "Mittel",
  SEVERE: "Stark",
  LETHAL: "Kritisch",
};

const ALLERGY_LEVEL_STYLES: Record<AllergyLevel, string> = {
  MILD: "border-emerald-300/50 bg-emerald-500/10 text-emerald-500",
  MODERATE: "border-amber-300/60 bg-amber-500/10 text-amber-500",
  SEVERE: "border-orange-400/60 bg-orange-500/15 text-orange-500",
  LETHAL: "border-red-500/70 bg-red-500/15 text-red-500",
};

const STYLE_BADGE_VARIANTS: Record<DietaryStyleOption, string> = {
  none: "border-border/60 bg-muted/40 text-muted-foreground",
  omnivore: "border-amber-400/60 bg-amber-500/10 text-amber-500",
  vegetarian: "border-emerald-400/60 bg-emerald-500/10 text-emerald-500",
  vegan: "border-lime-400/60 bg-lime-500/10 text-lime-500",
  pescetarian: "border-sky-400/60 bg-sky-500/10 text-sky-500",
  flexitarian: "border-cyan-400/60 bg-cyan-500/10 text-cyan-500",
  halal: "border-green-500/60 bg-green-500/10 text-green-500",
  kosher: "border-indigo-400/60 bg-indigo-500/10 text-indigo-500",
  custom: "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-400",
};

const STYLE_LABELS: Record<DietaryStyleOption, string> = {
  none: "Keine besondere Ernährung",
  omnivore: "Allesesser:in",
  vegetarian: "Vegetarisch",
  vegan: "Vegan",
  pescetarian: "Pescetarisch",
  flexitarian: "Flexitarisch",
  halal: "Halal",
  kosher: "Koscher",
  custom: "Individuell",
};

const SEVERITY_RANK: Record<AllergyLevel, number> = {
  MILD: 0,
  MODERATE: 1,
  SEVERE: 2,
  LETHAL: 3,
};

const MEAL_SLOTS = ["Frühstück", "Mittag", "Abendbrot"] as const;

type RecipeIngredient = {
  name: string;
  amount: number;
  unit: string;
  category?: string;
};

function normalizeAllergen(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}

function createLevelRecord(): Record<AllergyLevel, number> {
  return { MILD: 0, MODERATE: 0, SEVERE: 0, LETHAL: 0 };
}

type ParticipantDietProfile = {
  userId: string;
  name: string;
  style: DietaryStyleOption;
  styleLabel: string;
  customLabel: string | null;
  strictnessValue: DietaryStrictnessOption;
  strictnessLabel: string;
  restrictions: { allergen: string; level: AllergyLevel }[];
};

type StyleSummary = {
  key: string;
  style: DietaryStyleOption;
  label: string;
  count: number;
  share: number;
  dominantStrictnessValue: DietaryStrictnessOption;
  dominantStrictnessLabel: string;
  dominantStrictnessShare: number;
  sampleNames: string[];
};

type AllergenSummary = {
  key: string;
  name: string;
  total: number;
  highestLevel: AllergyLevel;
  affectedNames: string[];
  levels: Record<AllergyLevel, number>;
};

type DishConcept = {
  id: string;
  title: string;
  description: string;
  suitableFor: DietaryStyleOption[];
  highlights: string[];
  avoids: string[];
  caution?: string[];
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  idealSlots?: (typeof MEAL_SLOTS)[number][];
};

type MealPlanEntry = {
  slot: (typeof MEAL_SLOTS)[number];
  focusLabel: string;
  focusStyle: DietaryStyleOption;
  dish: DishConcept;
  cautionMatches: string[];
};

type MealPlanDay = {
  key: string;
  label: string;
  date: Date | null;
  entries: MealPlanEntry[];
};

type BuildMealPlanArgs = {
  startDate: Date | null;
  styleSummaries: StyleSummary[];
  criticalAllergens: Set<string>;
  dishes: DishConcept[];
};

const DISH_LIBRARY: DishConcept[] = [
  {
    id: "aurora-plant-bowl",
    title: "Aurora Plant Bowl",
    description: "Quinoa, Ofengemüse, pinker Hummus und Zitrus-Tahini im futuristischen Bento-Setup.",
    suitableFor: ["vegan", "vegetarian", "flexitarian", "halal"],
    highlights: ["proteinreich", "glutenfrei", "Meal-Prep"],
    avoids: ["Milch", "Ei"],
    caution: ["Sesam"],
    servings: 6,
    idealSlots: ["Mittag", "Abendbrot"],
    ingredients: [
      { name: "Quinoa", amount: 450, unit: "g", category: "Basis" },
      { name: "Süßkartoffeln", amount: 3, unit: "Stk", category: "Gemüse" },
      { name: "Kichererbsen (gekocht)", amount: 800, unit: "g", category: "Hülsenfrüchte" },
      { name: "Rote Bete", amount: 2, unit: "Knollen", category: "Gemüse" },
      { name: "Rote Paprika", amount: 3, unit: "Stk", category: "Gemüse" },
      { name: "Babyspinat", amount: 200, unit: "g", category: "Gemüse" },
      { name: "Tahini", amount: 160, unit: "g", category: "Vorrat" },
      { name: "Zitronensaft", amount: 80, unit: "ml", category: "Vorrat" },
      { name: "Olivenöl", amount: 90, unit: "ml", category: "Vorrat" },
      { name: "Knoblauchzehen", amount: 3, unit: "Stk", category: "Vorrat" },
      { name: "Salz", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Schwarzer Pfeffer", amount: 1, unit: "TL", category: "Gewürze" },
      { name: "Granatapfelkerne", amount: 120, unit: "g", category: "Topping" },
    ],
    instructions: [
      "Quinoa gründlich waschen und nach Packungsanleitung in Salzwasser garen.",
      "Süßkartoffeln, Rote Bete und Paprika würfeln, mit der Hälfte des Olivenöls sowie Salz und Pfeffer mischen und im Ofen bei 200 °C etwa 25 Minuten rösten.",
      "Kichererbsen abspülen und gemeinsam mit dem Babyspinat kurz in einer Pfanne mit etwas Olivenöl erwärmen.",
      "Tahini, übriges Olivenöl, Zitronensaft, Knoblauch und etwas Wasser cremig rühren. Bowls mit Quinoa, Ofengemüse und Kichererbsen anrichten, mit Tahini-Dressing und Granatapfelkernen toppen.",
    ],
  },
  {
    id: "lunar-lentil-stew",
    title: "Lunar Lentil Stew",
    description: "Belugalinsen in Chili-Tomatenfond mit Wurzelgemüse, Kräuteröl und knusprigen Lupinenchips.",
    suitableFor: ["vegan", "vegetarian", "halal", "custom"],
    highlights: ["wärmend", "eisenreich"],
    avoids: ["Milch", "Ei"],
    servings: 8,
    idealSlots: ["Mittag", "Abendbrot"],
    ingredients: [
      { name: "Belugalinsen", amount: 600, unit: "g", category: "Hülsenfrüchte" },
      { name: "Karotten", amount: 4, unit: "Stk", category: "Gemüse" },
      { name: "Staudensellerie", amount: 3, unit: "Stangen", category: "Gemüse" },
      { name: "Rote Zwiebeln", amount: 2, unit: "Stk", category: "Gemüse" },
      { name: "Knoblauchzehen", amount: 3, unit: "Stk", category: "Vorrat" },
      { name: "Tomaten aus der Dose", amount: 800, unit: "g", category: "Vorrat" },
      { name: "Gemüsefond", amount: 1.5, unit: "l", category: "Vorrat" },
      { name: "Chiliflocken", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Kreuzkümmel", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Lorbeerblätter", amount: 2, unit: "Stk", category: "Gewürze" },
      { name: "Olivenöl", amount: 60, unit: "ml", category: "Vorrat" },
      { name: "Salz", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Pfeffer", amount: 1, unit: "TL", category: "Gewürze" },
      { name: "Lupinenchips", amount: 120, unit: "g", category: "Topping" },
      { name: "Frischer Koriander", amount: 1, unit: "Bund", category: "Kräuter" },
    ],
    instructions: [
      "Linsen abspülen. Karotten, Sellerie und Zwiebeln fein würfeln, Knoblauch hacken.",
      "Olivenöl in einem großen Topf erhitzen und das Gemüse darin 5 Minuten anschwitzen. Chiliflocken und Kreuzkümmel hinzufügen und kurz mitrösten.",
      "Linsen, Tomaten, Lorbeer und Gemüsefond zugeben. Aufkochen, dann bei mittlerer Hitze 25–30 Minuten köcheln lassen, bis die Linsen weich sind.",
      "Mit Salz und Pfeffer abschmecken. Vor dem Servieren mit gehacktem Koriander und Lupinenchips bestreuen.",
    ],
  },
  {
    id: "stellar-salmon",
    title: "Stellar Citrus Salmon",
    description: "Yuzu-glasierter Lachs auf Wildreis mit Gurken-Fenchel-Salat und Shiso-Mayo.",
    suitableFor: ["pescetarian", "flexitarian", "omnivore"],
    highlights: ["Omega-3", "leicht"],
    avoids: ["Rind", "Schwein"],
    caution: ["Fisch", "Sesam"],
    servings: 6,
    idealSlots: ["Mittag", "Abendbrot"],
    ingredients: [
      { name: "Lachsfilets", amount: 6, unit: "Stk", category: "Protein" },
      { name: "Wildreis", amount: 400, unit: "g", category: "Basis" },
      { name: "Yuzu-Saft", amount: 60, unit: "ml", category: "Vorrat" },
      { name: "Sojasauce", amount: 40, unit: "ml", category: "Vorrat" },
      { name: "Honig", amount: 30, unit: "g", category: "Vorrat" },
      { name: "Gurken", amount: 2, unit: "Stk", category: "Gemüse" },
      { name: "Fenchelknollen", amount: 2, unit: "Stk", category: "Gemüse" },
      { name: "Reisessig", amount: 30, unit: "ml", category: "Vorrat" },
      { name: "Shiso-Blätter", amount: 12, unit: "Stk", category: "Kräuter" },
      { name: "Mayonnaise", amount: 120, unit: "g", category: "Vorrat" },
      { name: "Limettensaft", amount: 40, unit: "ml", category: "Vorrat" },
      { name: "Sesamöl", amount: 20, unit: "ml", category: "Vorrat" },
      { name: "Salz", amount: 1, unit: "TL", category: "Gewürze" },
      { name: "Schwarzer Pfeffer", amount: 0.5, unit: "TL", category: "Gewürze" },
    ],
    instructions: [
      "Wildreis in reichlich Salzwasser garen.",
      "Yuzu-Saft, Sojasauce und Honig verrühren, Lachsfilets darin 10 Minuten marinieren. Anschließend in einer Pfanne oder im Ofen garen, bis der Fisch glasig ist.",
      "Gurken und Fenchel fein hobeln und mit Reisessig, Sesamöl, Salz und Pfeffer marinieren.",
      "Mayonnaise mit Limettensaft und gehackten Shiso-Blättern mischen. Reis auf Teller geben, Lachs daraufsetzen, mit Salat und Shiso-Mayo servieren.",
    ],
  },
  {
    id: "cosmic-kufteh",
    title: "Cosmic Kufteh Bowls",
    description: "Safran-Bulgur, Linsenbällchen, Minz-Joghurt und Granatapfelkerne als modulare Bowl.",
    suitableFor: ["vegetarian", "halal", "custom"],
    highlights: ["Batch Cooking", "würzig"],
    avoids: ["Schwein"],
    caution: ["Gluten", "Milch"],
    servings: 6,
    idealSlots: ["Mittag", "Abendbrot"],
    ingredients: [
      { name: "Bulgur", amount: 400, unit: "g", category: "Basis" },
      { name: "Rote Linsen", amount: 250, unit: "g", category: "Hülsenfrüchte" },
      { name: "Zwiebeln", amount: 2, unit: "Stk", category: "Gemüse" },
      { name: "Karotten", amount: 2, unit: "Stk", category: "Gemüse" },
      { name: "Petersilie", amount: 1, unit: "Bund", category: "Kräuter" },
      { name: "Minze", amount: 0.5, unit: "Bund", category: "Kräuter" },
      { name: "Safranfäden", amount: 0.5, unit: "g", category: "Gewürze" },
      { name: "Griechischer Joghurt", amount: 300, unit: "g", category: "Milchprodukte" },
      { name: "Granatapfelkerne", amount: 120, unit: "g", category: "Topping" },
      { name: "Olivenöl", amount: 70, unit: "ml", category: "Vorrat" },
      { name: "Salz", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Korianderpulver", amount: 1, unit: "TL", category: "Gewürze" },
      { name: "Paprikapulver", amount: 1, unit: "TL", category: "Gewürze" },
    ],
    instructions: [
      "Bulgur mit Safran und heißem Wasser übergießen und quellen lassen.",
      "Rote Linsen in Salzwasser weich kochen, abgießen und mit fein gehackten Zwiebeln, Karotten und Petersilie mischen.",
      "Die Masse mit Salz, Koriander- und Paprikapulver würzen, Kugeln formen und in Olivenöl knusprig ausbacken.",
      "Minze fein hacken und unter den Joghurt rühren. Bowls mit Bulgur, Linsenbällchen, Joghurt und Granatapfel anrichten.",
    ],
  },
  {
    id: "orbit-citrus-chicken",
    title: "Orbit Citrus Chicken",
    description: "Zitronenthymian-Hähnchen, Süßkartoffel, Brokkolini und Kräuteröl – warm oder kalt servierbar.",
    suitableFor: ["omnivore", "flexitarian", "halal", "none"],
    highlights: ["Comfort", "laktosefrei"],
    avoids: ["Schwein"],
    servings: 8,
    idealSlots: ["Mittag", "Abendbrot"],
    ingredients: [
      { name: "Hähnchenschenkel", amount: 8, unit: "Stk", category: "Protein" },
      { name: "Süßkartoffeln", amount: 4, unit: "Stk", category: "Gemüse" },
      { name: "Brokkolini", amount: 600, unit: "g", category: "Gemüse" },
      { name: "Zitronen", amount: 2, unit: "Stk", category: "Obst" },
      { name: "Thymian", amount: 1, unit: "Bund", category: "Kräuter" },
      { name: "Knoblauchzehen", amount: 4, unit: "Stk", category: "Vorrat" },
      { name: "Olivenöl", amount: 90, unit: "ml", category: "Vorrat" },
      { name: "Ahornsirup", amount: 30, unit: "ml", category: "Vorrat" },
      { name: "Salz", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Pfeffer", amount: 1, unit: "TL", category: "Gewürze" },
    ],
    instructions: [
      "Hähnchen mit Zitronensaft, Thymian, gehacktem Knoblauch, Ahornsirup, Salz und Pfeffer marinieren.",
      "Süßkartoffeln würfeln, mit etwas Olivenöl und Salz mischen und auf ein Blech geben. Hähnchen darauf verteilen und bei 200 °C 35 Minuten rösten.",
      "Brokkolini blanchieren, danach in Olivenöl schwenken und mit Salz abschmecken.",
      "Alles zusammen auf Platten anrichten und mit Zitronenscheiben sowie frischem Thymian servieren.",
    ],
  },
  {
    id: "nebula-ratatouille",
    title: "Nebula Ratatouille",
    description: "Ofengeröstete Gemüsegalaxie mit Polenta-Cubes und Basilikum-Pistou.",
    suitableFor: ["vegan", "vegetarian", "flexitarian", "kosher"],
    highlights: ["Ofengericht", "sättigend"],
    avoids: ["Milch", "Ei"],
    caution: ["Nüsse"],
    servings: 8,
    idealSlots: ["Mittag", "Abendbrot"],
    ingredients: [
      { name: "Zucchini", amount: 4, unit: "Stk", category: "Gemüse" },
      { name: "Auberginen", amount: 2, unit: "Stk", category: "Gemüse" },
      { name: "Paprika", amount: 4, unit: "Stk", category: "Gemüse" },
      { name: "Kirschtomaten", amount: 500, unit: "g", category: "Gemüse" },
      { name: "Polenta", amount: 400, unit: "g", category: "Basis" },
      { name: "Gemüsefond", amount: 1.2, unit: "l", category: "Vorrat" },
      { name: "Basilikum", amount: 2, unit: "Bund", category: "Kräuter" },
      { name: "Olivenöl", amount: 100, unit: "ml", category: "Vorrat" },
      { name: "Pinienkerne", amount: 60, unit: "g", category: "Topping" },
      { name: "Knoblauchzehen", amount: 3, unit: "Stk", category: "Vorrat" },
      { name: "Zitronenschale", amount: 1, unit: "Stk", category: "Gewürze" },
      { name: "Salz", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Pfeffer", amount: 1, unit: "TL", category: "Gewürze" },
    ],
    instructions: [
      "Gemüse in Scheiben schneiden, mit Olivenöl, Salz, Pfeffer und Zitronenschale mischen und auf Blechen verteilen. Bei 190 °C 30 Minuten rösten.",
      "Polenta mit Gemüsefond aufkochen, unter Rühren ausquellen lassen und auf ein Blech streichen. Nach dem Auskühlen in Würfel schneiden und in Olivenöl knusprig braten.",
      "Basilikum, Pinienkerne, Knoblauch und Olivenöl zu einem Pistou mixen.",
      "Ratatouille-Gemüse mit Polenta-Cubes anrichten und mit Pistou beträufeln.",
    ],
  },
  {
    id: "galaxy-shakshuka",
    title: "Galaxy Morning Shakshuka",
    description: "Feurige Paprika-Tomatenbasis mit pochierten Eiern, Kräutern und Feta-Crumble.",
    suitableFor: ["vegetarian", "flexitarian", "kosher"],
    highlights: ["Brunch-tauglich", "energiegeladen"],
    avoids: [],
    caution: ["Ei", "Milch"],
    servings: 6,
    idealSlots: ["Frühstück", "Mittag"],
    ingredients: [
      { name: "Rote Paprika", amount: 3, unit: "Stk", category: "Gemüse" },
      { name: "Zwiebeln", amount: 2, unit: "Stk", category: "Gemüse" },
      { name: "Knoblauchzehen", amount: 3, unit: "Stk", category: "Vorrat" },
      { name: "Tomaten aus der Dose", amount: 800, unit: "g", category: "Vorrat" },
      { name: "Eier", amount: 12, unit: "Stk", category: "Protein" },
      { name: "Feta", amount: 200, unit: "g", category: "Milchprodukte" },
      { name: "Harissa", amount: 2, unit: "EL", category: "Gewürze" },
      { name: "Kreuzkümmel", amount: 1, unit: "TL", category: "Gewürze" },
      { name: "Olivenöl", amount: 50, unit: "ml", category: "Vorrat" },
      { name: "Frische Petersilie", amount: 1, unit: "Bund", category: "Kräuter" },
      { name: "Fladenbrot", amount: 3, unit: "Stk", category: "Beilage" },
      { name: "Salz", amount: 1.5, unit: "TL", category: "Gewürze" },
    ],
    instructions: [
      "Zwiebeln, Paprika und Knoblauch würfeln und in Olivenöl anschwitzen.",
      "Harissa und Kreuzkümmel zugeben, dann Tomaten einrühren und 10 Minuten einkochen lassen.",
      "Mit einem Löffel Mulden formen, Eier hineinschlagen und bei mittlerer Hitze stocken lassen.",
      "Mit zerbröckeltem Feta und gehackter Petersilie bestreuen und mit warmem Fladenbrot servieren.",
    ],
  },
  {
    id: "zen-noodle-box",
    title: "Zen Soba Box",
    description: "Buchweizennudeln, knackiges Gemüse, Ponzu-Dressing und knuspriger Tofu-Crunch.",
    suitableFor: ["vegan", "vegetarian", "pescetarian", "custom"],
    highlights: ["kalt servierbar", "schnell"],
    avoids: ["Milch", "Ei"],
    caution: ["Soja", "Sesam", "Gluten"],
    servings: 6,
    idealSlots: ["Mittag", "Abendbrot"],
    ingredients: [
      { name: "Soba-Nudeln", amount: 500, unit: "g", category: "Basis" },
      { name: "Fester Tofu", amount: 400, unit: "g", category: "Protein" },
      { name: "Edamame", amount: 300, unit: "g", category: "Hülsenfrüchte" },
      { name: "Karotten", amount: 3, unit: "Stk", category: "Gemüse" },
      { name: "Rotkohl", amount: 0.5, unit: "Kopf", category: "Gemüse" },
      { name: "Frühlingszwiebeln", amount: 1, unit: "Bund", category: "Gemüse" },
      { name: "Ponzu-Sauce", amount: 120, unit: "ml", category: "Vorrat" },
      { name: "Sesamöl", amount: 30, unit: "ml", category: "Vorrat" },
      { name: "Reisessig", amount: 40, unit: "ml", category: "Vorrat" },
      { name: "Gerösteter Sesam", amount: 30, unit: "g", category: "Topping" },
      { name: "Salz", amount: 1, unit: "TL", category: "Gewürze" },
      { name: "Pfeffer", amount: 0.5, unit: "TL", category: "Gewürze" },
    ],
    instructions: [
      "Soba nach Packungsanleitung kochen, kalt abschrecken und abtropfen lassen.",
      "Tofu würfeln und in Sesamöl knusprig braten. Mit Salz und Pfeffer würzen.",
      "Karotten in feine Streifen schneiden, Rotkohl hobeln, Frühlingszwiebeln in Ringe schneiden.",
      "Ponzu, Reisessig und Sesamöl verrühren. Nudeln mit Gemüse, Edamame und Tofu mischen, Dressing zugeben und mit Sesam toppen.",
    ],
  },
  {
    id: "starlight-overnight-oats",
    title: "Starlight Overnight Oats",
    description: "Haferflocken, Chiasamen und Pflanzenmilch mit Sternenstaub-Toppings für den frühen Energieschub.",
    suitableFor: ["vegan", "vegetarian", "flexitarian", "pescetarian"],
    highlights: ["Meal-Prep", "ballaststoffreich"],
    avoids: ["Milch", "Ei"],
    servings: 6,
    idealSlots: ["Frühstück"],
    ingredients: [
      { name: "Feine Haferflocken", amount: 360, unit: "g", category: "Basis" },
      { name: "Chiasamen", amount: 60, unit: "g", category: "Vorrat" },
      { name: "Pflanzendrink", amount: 1.2, unit: "l", category: "Vorrat" },
      { name: "Ahornsirup", amount: 60, unit: "ml", category: "Vorrat" },
      { name: "Vanilleextrakt", amount: 2, unit: "TL", category: "Gewürze" },
      { name: "Heidelbeeren", amount: 300, unit: "g", category: "Obst" },
      { name: "Mango", amount: 2, unit: "Stk", category: "Obst" },
      { name: "Kokoschips", amount: 80, unit: "g", category: "Topping" },
      { name: "Limettenschale", amount: 1, unit: "Stk", category: "Gewürze" },
    ],
    instructions: [
      "Haferflocken, Chiasamen, Pflanzendrink, Ahornsirup und Vanille in einer großen Schüssel verrühren.",
      "Mischung in verschließbare Behälter füllen und über Nacht kalt stellen.",
      "Mango würfeln, Heidelbeeren waschen.",
      "Vor dem Servieren Oats mit Mango, Heidelbeeren, Kokoschips und etwas Limettenschale toppen.",
    ],
  },
  {
    id: "meteor-morning-parfait",
    title: "Meteor Morning Parfait",
    description: "Schichtdessert aus Skyr, Gewürz-Granola, Kompott und Kakaonibs für den süßen Start.",
    suitableFor: ["vegetarian", "flexitarian", "none"],
    highlights: ["vorbereitbar", "proteinreich"],
    avoids: ["Schwein"],
    caution: ["Milch", "Gluten", "Nüsse"],
    servings: 6,
    idealSlots: ["Frühstück"],
    ingredients: [
      { name: "Skyr", amount: 900, unit: "g", category: "Milchprodukte" },
      { name: "Honig", amount: 50, unit: "g", category: "Vorrat" },
      { name: "Zimtgranola", amount: 240, unit: "g", category: "Topping" },
      { name: "Erdbeeren", amount: 400, unit: "g", category: "Obst" },
      { name: "Rhabarber", amount: 250, unit: "g", category: "Obst" },
      { name: "Orangensaft", amount: 120, unit: "ml", category: "Vorrat" },
      { name: "Kakaonibs", amount: 60, unit: "g", category: "Topping" },
      { name: "Frische Minze", amount: 1, unit: "Bund", category: "Kräuter" },
    ],
    instructions: [
      "Rhabarber schälen, mit halbierten Erdbeeren und Orangensaft kurz aufkochen und zu einem Kompott einkochen.",
      "Skyr mit Honig glatt rühren.",
      "Gläser schichten: Skyr, Kompott, Granola. Wiederholen, bis die Zutaten aufgebraucht sind.",
      "Mit Kakaonibs und gehackter Minze bestreuen und bis zum Servieren kalt stellen.",
    ],
  },
  {
    id: "orbit-breakfast-wraps",
    title: "Orbit Breakfast Wraps",
    description: "Weiche Tortillas mit Rührei, Bohnen, Avocado und Kräuter-Salsa – perfekt zum Mitnehmen.",
    suitableFor: ["omnivore", "flexitarian", "custom"],
    highlights: ["to-go", "sättigend"],
    avoids: ["Schwein"],
    caution: ["Ei", "Gluten"],
    servings: 6,
    idealSlots: ["Frühstück"],
    ingredients: [
      { name: "Weizentortillas", amount: 6, unit: "Stk", category: "Basis" },
      { name: "Eier", amount: 10, unit: "Stk", category: "Protein" },
      { name: "Schwarze Bohnen", amount: 400, unit: "g", category: "Hülsenfrüchte" },
      { name: "Cheddar", amount: 150, unit: "g", category: "Milchprodukte" },
      { name: "Avocado", amount: 2, unit: "Stk", category: "Obst" },
      { name: "Kirschtomaten", amount: 250, unit: "g", category: "Obst" },
      { name: "Koriander", amount: 1, unit: "Bund", category: "Kräuter" },
      { name: "Limetten", amount: 2, unit: "Stk", category: "Obst" },
      { name: "Olivenöl", amount: 30, unit: "ml", category: "Vorrat" },
      { name: "Salz", amount: 1, unit: "TL", category: "Gewürze" },
      { name: "Pfeffer", amount: 0.5, unit: "TL", category: "Gewürze" },
      { name: "Rauchpaprika", amount: 1, unit: "TL", category: "Gewürze" },
    ],
    instructions: [
      "Eier verquirlen und in Olivenöl zu einem cremigen Rührei stocken lassen.",
      "Bohnen abspülen, mit Rauchpaprika und etwas Salz in einer Pfanne erwärmen.",
      "Avocado und Tomaten würfeln, mit Limettensaft, Salz und gehacktem Koriander zu einer Salsa vermischen.",
      "Tortillas erwärmen, mit Bohnen, Rührei, geriebenem Cheddar und Salsa füllen und eng einrollen.",
    ],
  },
];

function pickDishForStyle(
  style: DietaryStyleOption,
  slot: (typeof MEAL_SLOTS)[number],
  dishes: DishConcept[],
  used: Set<string>,
): DishConcept {
  const slotCandidates = dishes.filter((dish) => {
    if (!dish.suitableFor.includes(style)) {
      return false;
    }
    if (!dish.idealSlots || dish.idealSlots.length === 0) {
      return true;
    }
    return dish.idealSlots.includes(slot);
  });
  const availableSlotCandidate = slotCandidates.find((dish) => !used.has(dish.id));
  if (availableSlotCandidate) {
    used.add(availableSlotCandidate.id);
    return availableSlotCandidate;
  }

  if (slotCandidates.length) {
    return slotCandidates[0];
  }

  const styleCandidates = dishes.filter((dish) => dish.suitableFor.includes(style));
  const availableStyleCandidate = styleCandidates.find((dish) => !used.has(dish.id));
  if (availableStyleCandidate) {
    used.add(availableStyleCandidate.id);
    return availableStyleCandidate;
  }

  if (styleCandidates.length) {
    return styleCandidates[0];
  }

  const fallback = dishes.find((dish) => !used.has(dish.id));
  if (fallback) {
    used.add(fallback.id);
    return fallback;
  }

  return dishes[0];
}

function buildMealPlan({ startDate, styleSummaries, criticalAllergens, dishes }: BuildMealPlanArgs): MealPlanDay[] {
  const focusList = styleSummaries.length
    ? styleSummaries
    : [
        {
          key: "omnivore",
          style: "omnivore" as const,
          label: STYLE_LABELS.omnivore,
          count: 0,
          share: 0,
          dominantStrictnessValue: "flexible" as const,
          dominantStrictnessLabel: resolveDietaryStrictnessLabel("omnivore", "flexible"),
          dominantStrictnessShare: 0,
          sampleNames: [],
        },
      ];

  const dayCount = 5;
  const used = new Set<string>();
  const formatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });

  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const date = startDate ? new Date(startDate.getTime() + dayIndex * 86_400_000) : null;
    const label = date ? formatter.format(date) : `Tag ${dayIndex + 1}`;
    const entries = MEAL_SLOTS.map((slot, slotIndex) => {
      const focus = focusList[(dayIndex + slotIndex) % focusList.length];
      const dish = pickDishForStyle(focus.style, slot, dishes, used);
      const cautionMatches = (dish.caution ?? []).filter((entry) => criticalAllergens.has(normalizeAllergen(entry)));
      return {
        slot,
        focusLabel: focus.label,
        focusStyle: focus.style,
        dish,
        cautionMatches,
      } satisfies MealPlanEntry;
    });

    return {
      key: date ? date.toISOString().slice(0, 10) : `day-${dayIndex}`,
      label,
      date,
      entries,
    } satisfies MealPlanDay;
  });
}

export default async function EssensplanungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.essenplanung");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
        Kein Zugriff auf die Essensplanung.
      </div>
    );
  }

  const activeProductionId = await getActiveProductionId();
  const [activeShow, profiles, rawRestrictions] = await Promise.all([
    activeProductionId
      ? prisma.show.findUnique({
          where: { id: activeProductionId },
          select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
        })
      : Promise.resolve(null),
    prisma.memberOnboardingProfile.findMany({
      where: { user: { deactivatedAt: null } },
      select: {
        userId: true,
        dietaryPreference: true,
        dietaryPreferenceStrictness: true,
        user: { select: { firstName: true, lastName: true, name: true, email: true } },
      },
    }),
    prisma.dietaryRestriction.findMany({
      where: { isActive: true, user: { deactivatedAt: null } },
      select: { userId: true, allergen: true, level: true },
    }),
  ]);

  let show = activeShow;
  if (!show) {
    show =
      (await prisma.show.findFirst({
        where: { finalRehearsalWeekStart: { not: null } },
        orderBy: { finalRehearsalWeekStart: "desc" },
        select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
      })) ??
      (await prisma.show.findFirst({
        orderBy: { year: "desc" },
        select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
      }));
  }

  const restrictionsByUser = new Map<string, { allergen: string; level: AllergyLevel }[]>();
  for (const entry of rawRestrictions) {
    const list = restrictionsByUser.get(entry.userId) ?? [];
    list.push({ allergen: entry.allergen, level: entry.level });
    restrictionsByUser.set(entry.userId, list);
  }

  const participants: ParticipantDietProfile[] = profiles.map((profile) => {
    const user = profile.user;
    const name = getUserDisplayName({
      firstName: user?.firstName ?? undefined,
      lastName: user?.lastName ?? undefined,
      name: user?.name ?? undefined,
      email: user?.email ?? undefined,
    });

    const { style, customLabel } = parseDietaryStyleFromLabel(profile.dietaryPreference);
    const styleResolution = resolveDietaryStyleLabel(style, customLabel ?? undefined);
    const strictnessValue = parseDietaryStrictnessFromLabel(profile.dietaryPreferenceStrictness);
    const strictnessLabelRaw = profile.dietaryPreferenceStrictness?.trim();
    const strictnessLabel = strictnessLabelRaw && strictnessLabelRaw.length > 0
      ? strictnessLabelRaw
      : resolveDietaryStrictnessLabel(style, strictnessValue);

    const restrictions = (restrictionsByUser.get(profile.userId) ?? []).sort((a, b) => {
      const rankDiff = SEVERITY_RANK[b.level] - SEVERITY_RANK[a.level];
      if (rankDiff !== 0) return rankDiff;
      return a.allergen.localeCompare(b.allergen, "de-DE");
    });

    return {
      userId: profile.userId,
      name,
      style,
      styleLabel: styleResolution.label,
      customLabel: styleResolution.custom,
      strictnessValue,
      strictnessLabel,
      restrictions,
    } satisfies ParticipantDietProfile;
  });

  const totalParticipants = participants.length;
  const restrictionsWithSeverity = participants.flatMap((participant) => participant.restrictions);
  const participantsWithRestrictions = participants.filter((participant) => participant.restrictions.length > 0).length;
  const strictParticipants = participants.filter((participant) => participant.strictnessValue === "strict").length;
  const criticalRestrictionCount = restrictionsWithSeverity.filter(
    (entry) => SEVERITY_RANK[entry.level] >= SEVERITY_RANK.SEVERE,
  ).length;

  const styleBuckets = new Map<
    string,
    {
      key: string;
      style: DietaryStyleOption;
      label: string;
      count: number;
      strictness: Map<DietaryStrictnessOption, number>;
      sampleNames: Set<string>;
    }
  >();

  for (const participant of participants) {
    const identifier = participant.style === "custom"
      ? `custom:${(participant.customLabel ?? participant.styleLabel).toLocaleLowerCase("de-DE")}`
      : participant.style;

    let bucket = styleBuckets.get(identifier);
    if (!bucket) {
      bucket = {
        key: identifier,
        style: participant.style,
        label: participant.customLabel ?? participant.styleLabel,
        count: 0,
        strictness: new Map<DietaryStrictnessOption, number>(),
        sampleNames: new Set<string>(),
      };
      styleBuckets.set(identifier, bucket);
    }

    bucket.count += 1;
    bucket.strictness.set(
      participant.strictnessValue,
      (bucket.strictness.get(participant.strictnessValue) ?? 0) + 1,
    );
    if (bucket.sampleNames.size < 3) {
      bucket.sampleNames.add(participant.name);
    }
  }

  const styleSummaries: StyleSummary[] = Array.from(styleBuckets.values()).map((bucket) => {
    const strictnessEntries = Array.from(bucket.strictness.entries()).sort((a, b) => b[1] - a[1]);
    const dominantEntry = strictnessEntries[0];
    const dominantStrictnessValue = dominantEntry ? dominantEntry[0] : ("flexible" as DietaryStrictnessOption);
    const dominantStrictnessCount = dominantEntry ? dominantEntry[1] : 0;
    const dominantStrictnessLabel = resolveDietaryStrictnessLabel(bucket.style, dominantStrictnessValue);
    const sampleNames = Array.from(bucket.sampleNames).sort((a, b) => a.localeCompare(b, "de-DE"));
    return {
      key: bucket.key,
      style: bucket.style,
      label: bucket.label,
      count: bucket.count,
      share: totalParticipants ? Math.round((bucket.count / totalParticipants) * 100) : 0,
      dominantStrictnessValue,
      dominantStrictnessLabel,
      dominantStrictnessShare: bucket.count
        ? Math.round((dominantStrictnessCount / bucket.count) * 100)
        : 0,
      sampleNames,
    } satisfies StyleSummary;
  }).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label, "de-DE");
  });

  const allergenMap = new Map<
    string,
    {
      key: string;
      name: string;
      total: number;
      highestLevel: AllergyLevel;
      affected: Set<string>;
      levels: Record<AllergyLevel, number>;
    }
  >();

  for (const participant of participants) {
    for (const restriction of participant.restrictions) {
      const normalized = normalizeAllergen(restriction.allergen);
      const existing = allergenMap.get(normalized);
      if (existing) {
        existing.total += 1;
        existing.levels[restriction.level] += 1;
        if (SEVERITY_RANK[restriction.level] > SEVERITY_RANK[existing.highestLevel]) {
          existing.highestLevel = restriction.level;
          existing.name = restriction.allergen;
        }
        existing.affected.add(participant.name);
      } else {
        const bucket = {
          key: normalized,
          name: restriction.allergen,
          total: 1,
          highestLevel: restriction.level,
          affected: new Set([participant.name]),
          levels: createLevelRecord(),
        };
        bucket.levels[restriction.level] = 1;
        allergenMap.set(normalized, bucket);
      }
    }
  }

  const criticalAllergens = new Set<string>();
  const allergenSummaries: AllergenSummary[] = Array.from(allergenMap.values()).map((bucket) => {
    const affectedNames = Array.from(bucket.affected).sort((a, b) => a.localeCompare(b, "de-DE"));
    if (SEVERITY_RANK[bucket.highestLevel] >= SEVERITY_RANK.SEVERE) {
      criticalAllergens.add(bucket.key);
    }
    return {
      key: bucket.key,
      name: bucket.name,
      total: bucket.total,
      highestLevel: bucket.highestLevel,
      affectedNames,
      levels: bucket.levels,
    } satisfies AllergenSummary;
  }).sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.highestLevel] - SEVERITY_RANK[a.highestLevel];
    if (severityDiff !== 0) return severityDiff;
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name, "de-DE");
  });

  const mealPlan = buildMealPlan({
    startDate: show?.finalRehearsalWeekStart ?? null,
    styleSummaries,
    criticalAllergens,
    dishes: DISH_LIBRARY,
  });

  const priorityProfiles = participants
    .filter((participant) => {
      const maxSeverity = participant.restrictions.reduce((acc, entry) => Math.max(acc, SEVERITY_RANK[entry.level]), 0);
      return participant.strictnessValue === "strict" || maxSeverity >= SEVERITY_RANK.SEVERE;
    })
    .sort((a, b) => {
      const maxA = a.restrictions.reduce((acc, entry) => Math.max(acc, SEVERITY_RANK[entry.level]), 0);
      const maxB = b.restrictions.reduce((acc, entry) => Math.max(acc, SEVERITY_RANK[entry.level]), 0);
      if (maxB !== maxA) return maxB - maxA;
      if (b.restrictions.length !== a.restrictions.length) return b.restrictions.length - a.restrictions.length;
      if (a.strictnessValue !== b.strictnessValue) {
        if (a.strictnessValue === "strict") return -1;
        if (b.strictnessValue === "strict") return 1;
      }
      return a.name.localeCompare(b.name, "de-DE");
    })
    .slice(0, 6);

  const finalWeekStart = show?.finalRehearsalWeekStart ?? null;
  const numberFormatter = new Intl.NumberFormat("de-DE");
  const dayDateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
  const finalWeekStartLabel = finalWeekStart
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(finalWeekStart)
    : null;
  const finalWeekCountdown = finalWeekStart
    ? Math.max(0, Math.ceil((finalWeekStart.getTime() - Date.now()) / 86_400_000))
    : null;
  const finalWeekEnd = finalWeekStart ? new Date(finalWeekStart.getTime() + 6 * 86_400_000) : null;
  const finalWeekRangeLabel = finalWeekStart && finalWeekEnd
    ? `${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(finalWeekStart)} – ${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(finalWeekEnd)}`
    : null;

  const metrics = [
    {
      label: "Profile erfasst",
      value: numberFormatter.format(totalParticipants),
      hint: `${numberFormatter.format(strictParticipants)} strikt • ${numberFormatter.format(participantsWithRestrictions)} Allergieprofile`,
    },
    {
      label: "Kritische Unverträglichkeiten",
      value: numberFormatter.format(criticalRestrictionCount),
      hint: `${numberFormatter.format(criticalAllergens.size)} sensible Allergene`,
    },
    {
      label: "Ernährungscluster",
      value: numberFormatter.format(styleSummaries.length),
      hint: styleSummaries.length
        ? `${styleSummaries[0].label} führt mit ${styleSummaries[0].share}%`
        : "Noch keine Angaben",
    },
    {
      label: finalWeekCountdown !== null ? "Countdown" : "Finale Woche",
      value: finalWeekCountdown !== null ? numberFormatter.format(finalWeekCountdown) : "Offen",
      hint: finalWeekCountdown !== null ? "Tage bis Start" : "Bitte Termin definieren",
    },
  ];

  const plannerDays = mealPlan.map((day) => ({
    key: day.key,
    label: day.label,
    dateLabel: day.date ? dayDateFormatter.format(day.date) : null,
    slots: day.entries.map((entry) => ({
      slot: entry.slot,
      focusLabel: entry.focusLabel,
      focusStyle: entry.focusStyle,
      dishId: entry.dish.id,
    })),
  }));
  const defaultParticipantCount = totalParticipants > 0 ? totalParticipants : 12;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Essensplanung"
        description="Plane kompakt die Verpflegung der Endprobenwoche – gebündelt nach Ernährungsstilen, Strengegraden und Allergierisiken."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.66fr)_minmax(0,0.34fr)] xl:items-start">
        <div className="space-y-4">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background/80 shadow-[0_25px_60px_rgba(59,130,246,0.18)]">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <ChefHat className="h-5 w-5 text-primary" />
                  Finale Essensmatrix
                </CardTitle>
                {finalWeekStartLabel ? (
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                    Start {finalWeekStartLabel}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning/60 bg-warning/10 text-warning">
                    Datum fehlt
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Die Kennzahlen basieren auf aktuellen Onboarding-Profilen und aktiven Allergieeinträgen. Nutze sie als Startpunkt für die Menüplanung.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-primary/20 bg-background/80 p-3 shadow-sm backdrop-blur"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
                      {metric.label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{metric.value}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
                  </div>
                ))}
              </div>
              {finalWeekRangeLabel ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Geplante Versorgungsphase: {finalWeekRangeLabel}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Meal-Plan Vorschlag</CardTitle>
              <p className="text-sm text-muted-foreground">
                Automatisch generierte Menüideen pro Tag – ausgerichtet auf die stärksten Ernährungscluster und unter Berücksichtigung kritischer Allergene.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {totalParticipants === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                  Noch keine Ernährungsprofile hinterlegt. Sobald Angaben vorhanden sind, erscheinen hier Vorschläge.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {mealPlan.map((day) => (
                    <div
                      key={day.key}
                      className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-foreground/[0.03] via-background to-background p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{day.label}</div>
                          {day.date ? (
                            <div className="text-xs text-muted-foreground/80">
                              {dayDateFormatter.format(day.date)}
                            </div>
                          ) : null}
                        </div>
                        <Badge variant="outline" className="border-border/50 bg-background/80 text-xs text-muted-foreground">
                          {day.entries.map((entry) => entry.focusLabel).join(" • ")}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {day.entries.map((entry) => (
                          <div
                            key={`${day.key}-${entry.slot}`}
                            className="rounded-xl border border-border/50 bg-background/80 p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{entry.slot}</div>
                                <p className="text-sm font-semibold text-foreground">{entry.dish.title}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border-transparent text-[11px]",
                                  STYLE_BADGE_VARIANTS[entry.focusStyle] ?? "border-border/60 bg-muted/40 text-muted-foreground",
                                )}
                              >
                                {STYLE_LABELS[entry.focusStyle]}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{entry.dish.description}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                              {entry.dish.highlights.map((highlight) => (
                                <span
                                  key={`${entry.dish.id}-${highlight}`}
                                  className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary"
                                >
                                  {highlight}
                                </span>
                              ))}
                              {entry.dish.avoids.map((avoid) => (
                                <span
                                  key={`${entry.dish.id}-avoid-${avoid}`}
                                  className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-500"
                                >
                                  ohne {avoid}
                                </span>
                              ))}
                            </div>
                            {entry.cautionMatches.length ? (
                              <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <span>
                                  Allergiewarnung: {entry.cautionMatches.join(", ")}
                                </span>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-500">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Kritische Allergene werden vermieden.</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <MealPlanRecipeWorkbench
            library={DISH_LIBRARY}
            days={plannerDays}
            defaultParticipants={defaultParticipantCount}
            mealSlots={MEAL_SLOTS}
            styleBadgeVariants={STYLE_BADGE_VARIANTS}
          />
        </div>

        <div className="space-y-4">
          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Ernährungscluster</CardTitle>
              <p className="text-sm text-muted-foreground">
                Verteilung der gemeldeten Ernährungsstile inklusive dominanter Strengegrade. Nutze sie, um Buffet-Linien zu priorisieren.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {styleSummaries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Noch keine Angaben vorhanden.
                </p>
              ) : (
                styleSummaries.map((summary) => (
                  <div
                    key={summary.key}
                    className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{summary.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Strenge: {summary.dominantStrictnessLabel} ({summary.dominantStrictnessShare}%)
                        </p>
                      </div>
                      <Badge variant="outline" className="border-border/60 bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {summary.count} Personen · {summary.share}%
                      </Badge>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary/40 to-transparent"
                        style={{ width: `${summary.share}%` }}
                      />
                    </div>
                    {summary.sampleNames.length ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {summary.sampleNames.map((name) => (
                          <span key={name} className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5">
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Allergie-Watchlist</CardTitle>
              <p className="text-sm text-muted-foreground">
                Kritische Allergene mit betroffenen Personen und Schweregrad. Plane getrennte Ausgabestationen oder Zusatzbeschilderung.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {allergenSummaries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Keine aktiven Allergiehinweise.
                </p>
              ) : (
                allergenSummaries.map((entry) => {
                  const levelBadges = (Object.keys(entry.levels) as AllergyLevel[])
                    .filter((level) => entry.levels[level] > 0)
                    .map((level) => (
                      <span
                        key={`${entry.key}-${level}`}
                        className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {ALLERGY_LEVEL_LABELS[level]}: {entry.levels[level]}
                      </span>
                    ));
                  return (
                    <div
                      key={entry.key}
                      className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Betroffen: {entry.affectedNames.join(", ")}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0.5 text-xs",
                            ALLERGY_LEVEL_STYLES[entry.highestLevel] ?? "border-border/60 bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {ALLERGY_LEVEL_LABELS[entry.highestLevel]}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">{levelBadges}</div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Priorisierte Profile</CardTitle>
              <p className="text-sm text-muted-foreground">
                Mitglieder mit strikten Ernährungsangaben oder hohen Allergiestufen – ideal für individuelles Briefing und Testverkostungen.
              </p>
            </CardHeader>
            <CardContent>
              {priorityProfiles.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Keine kritischen Profile hervorgehoben.
                </p>
              ) : (
                <ul className="space-y-3">
                  {priorityProfiles.map((profile) => {
                    const remaining = profile.restrictions.length - 3;
                    return (
                      <li
                        key={profile.userId}
                        className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{profile.name}</p>
                            <p className="text-xs text-muted-foreground">{profile.strictnessLabel}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-transparent text-[11px]",
                              STYLE_BADGE_VARIANTS[profile.style] ?? "border-border/60 bg-muted/40 text-muted-foreground",
                            )}
                          >
                            {profile.styleLabel}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          {profile.restrictions.slice(0, 3).map((restriction, index) => (
                            <span
                              key={`${profile.userId}-${restriction.allergen}-${index}`}
                              className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5"
                            >
                              {restriction.allergen} · {ALLERGY_LEVEL_LABELS[restriction.level]}
                            </span>
                          ))}
                          {remaining > 0 ? (
                            <span className="rounded-full border border-border/40 bg-background/70 px-2 py-0.5">
                              +{remaining} weitere
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
