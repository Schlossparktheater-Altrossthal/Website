import { describe, expect, it } from "vitest";

import { needsDietaryConfirmation } from "../returnee-update-wizard";

const allergy = {
  allergen: "Erdnüsse",
  level: "SEVERE",
  symptoms: null,
  treatment: null,
  note: null,
};

describe("needsDietaryConfirmation", () => {
  it("verlangt eine Bestätigung, wenn Allergien übernommen wurden", () => {
    expect(needsDietaryConfirmation({ dietaryPreference: null }, [allergy])).toBe(true);
  });

  it("verlangt eine Bestätigung, wenn ein Ernährungsstil übernommen wurde", () => {
    expect(needsDietaryConfirmation({ dietaryPreference: "vegan" }, [])).toBe(true);
  });

  it("verlangt nichts, wenn keine Angaben vorliegen", () => {
    expect(needsDietaryConfirmation({ dietaryPreference: null }, [])).toBe(false);
    expect(needsDietaryConfirmation({ dietaryPreference: "  " }, [])).toBe(false);
  });
});
