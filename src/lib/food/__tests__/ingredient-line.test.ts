import { describe, expect, it } from "vitest";

import { parseIngredientLine } from "@/lib/food/recipes/ingredient-line";

describe("parseIngredientLine", () => {
  it.each([
    ["200 g Mehl (Type 405)", 200, "g", "Mehl", "Type 405"],
    ["3 große Zwiebel(n)", 3, null, "Zwiebel", "große"],
    ["1 kleiner Bund frischer Basilikum", 1, "bund", "Basilikum", "kleiner, frischer"],
    ["etwas Salz", null, null, "Salz", null],
    ["Etwas Parmesan zum Servieren", null, null, "Parmesan", "zum Servieren"],
    ["etwas Nudelwasser nach Bedarf", null, null, "Nudelwasser", "nach Bedarf"],
    ["1 Bio-Zitrone", 1, null, "Zitrone", null],
    ["2 EL Olivenöl", 2, "el", "Olivenöl", null],
    ["150 g Weichkäse", 150, "g", "Weichkäse", null],
  ])("%s", (line, amount, unit, name, note) => {
    const parsed = parseIngredientLine(line);
    expect(parsed).toMatchObject({ amount, unit, name, note });
  });
});
