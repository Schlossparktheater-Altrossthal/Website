import { describe, expect, it } from "vitest";

import {
  legacyBackgroundFromPayload,
  readStoredEducation,
  resolveBszCampus,
  toEducationPayload,
  validateEducation,
} from "../schools";

describe("resolveBszCampus", () => {
  it("erkennt beide Standorte auch in alten Freitexten", () => {
    expect(resolveBszCampus("BSZ Canaletto – Berufliches Gymnasium")).toBe("canaletto");
    expect(resolveBszCampus("Canalettostraße")).toBe("canaletto");
    expect(resolveBszCampus("BSZ Altroßthal – Berufsschule")).toBe("altrossthal");
    expect(resolveBszCampus("Altrossthal")).toBe("altrossthal");
    expect(resolveBszCampus("Gymnasium Plauen")).toBeNull();
  });
});

describe("readStoredEducation / toEducationPayload", () => {
  it("speichert den BSZ-Standort als kanonischen Schulnamen", () => {
    const payload = toEducationPayload({
      ...readStoredEducation(null),
      kind: "school",
      campus: "canaletto",
      className: "KOE 24",
    });
    expect(payload.educationCategory).toBe("school_bsz");
    expect(payload.educationSchoolName).toContain("Standort Canalettostraße");
    expect(readStoredEducation(payload)).toMatchObject({
      campus: "canaletto",
      className: "KOE 24",
    });
    expect(legacyBackgroundFromPayload(payload)).toEqual({
      background: "BSZ Canalettostraße",
      backgroundClass: "KOE 24",
    });
  });

  it("liest alte Onboarding-Werte mit nur dem Standortnamen", () => {
    expect(
      readStoredEducation({ educationCategory: "school_bsz", educationSchoolName: "Altroßthal" }),
    ).toMatchObject({ kind: "school", campus: "altrossthal" });
  });

  it("übernimmt alte Profil-Freitexte", () => {
    expect(
      readStoredEducation({
        background: "BSZ Canaletto – Berufliches Gymnasium",
        backgroundClass: "BG 12",
      }),
    ).toMatchObject({ kind: "school", campus: "canaletto", className: "BG 12" });
  });
});

describe("validateEducation", () => {
  it("verlangt Standort und Klasse am BSZ", () => {
    const base = readStoredEducation(null);
    expect(validateEducation({ ...base, kind: "school" })).toMatch(/Schule/);
    expect(validateEducation({ ...base, kind: "school", campus: "altrossthal" })).toMatch(/Klasse/);
    expect(
      validateEducation({ ...base, kind: "school", campus: "altrossthal", className: "BG 12" }),
    ).toBeNull();
  });
});
