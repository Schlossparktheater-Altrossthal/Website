import { describe, expect, it } from "vitest";

import { splitAllergenList } from "@/lib/food/split-list";

describe("splitAllergenList", () => {
  it.each([
    ["Erdnüsse, rote Beete", ["Erdnüsse", "rote Beete"]],
    [
      "Fructose-Intolleranz; Knoblauch-Unverträglichkeit",
      ["Fructose-Intolleranz", "Knoblauch-Unverträglichkeit"],
    ],
    ["Linsen (rot, gelb)", ["Linsen (rot, gelb)"]],
    ["Laktose, laktose,  Tomaten ,", ["Laktose", "Tomaten"]],
    ["Rind/Schwein", ["Rind/Schwein"]],
  ])("%s", (input, expected) => expect(splitAllergenList(input)).toEqual(expected));
});
