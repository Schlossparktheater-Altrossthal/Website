import type { FoodItem } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { veganAware } from "@/lib/food/recipes/service";

import { fixtureIndex } from "./fixture";

const index = fixtureIndex();
const butter = { id: "f1", taxonCodes: ["en:butter", "en:milk"] } as FoodItem;
const match = { foodItem: butter, taxonCodes: ["en:butter"], status: "MATCHED" as const };

describe("veganAware", () => {
  it("lässt Zeilen ohne Vegan-Hinweis unverändert", () => {
    expect(veganAware(index, "250 g Butter", match)).toBe(match);
  });

  it("verwirft tierische Treffer bei „vegane Butter“ und „Butter (vegan)“", () => {
    for (const text of ["20 g vegane Butter", "100 g Butter (vegan)", "pflanzliche Butter"]) {
      expect(veganAware(index, text, match)).toEqual({
        foodItem: null,
        taxonCodes: [],
        status: "UNCLEAR",
      });
    }
  });

  it("behält pflanzliche Treffer", () => {
    const oat = { foodItem: null, taxonCodes: ["en:oat"], status: "MATCHED" as const };
    expect(veganAware(index, "Hafer (vegan)", oat)).toBe(oat);
  });
});
