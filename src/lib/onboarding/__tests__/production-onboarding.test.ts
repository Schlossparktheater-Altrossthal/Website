import { describe, expect, it } from "vitest";

import { PROFILE_SNAPSHOT_VERSION, buildProfileSnapshot } from "../production-onboarding";

describe("buildProfileSnapshot", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  it("hält bestätigte Angaben versioniert fest", () => {
    const snapshot = buildProfileSnapshot(
      {
        dietaryPreference: "Vegetarisch",
        dietaryPreferenceStrictness: "streng",
        dietary: [{ allergen: "Erdnüsse", level: "SEVERE" }],
        preferences: [
          { code: "licht", domain: "crew", weight: 3 },
          { code: "ton", domain: "crew", weight: 0 },
        ],
        photoConsent: true,
      },
      now,
    );

    expect(snapshot).toEqual({
      version: PROFILE_SNAPSHOT_VERSION,
      confirmedAt: "2026-09-23T12:00:00.000Z",
      dietaryPreference: "Vegetarisch",
      dietaryPreferenceStrictness: "streng",
      dietary: [
        { allergen: "Erdnüsse", level: "SEVERE", symptoms: null, treatment: null, note: null },
      ],
      preferences: [{ code: "licht", domain: "crew", weight: 3 }],
      photoConsent: true,
      education: null,
      notes: null,
    });
  });

  it("übernimmt Ausbildungsangaben", () => {
    const snapshot = buildProfileSnapshot(
      {
        dietaryPreference: null,
        dietaryPreferenceStrictness: null,
        dietary: [],
        preferences: [],
        photoConsent: null,
        education: { category: "work", workDescription: "Tischlerei" },
      },
      now,
    );

    expect(snapshot.education).toEqual({
      category: "work",
      schoolName: null,
      className: null,
      workDescription: "Tischlerei",
      universityName: null,
      otherDescription: null,
    });
  });
});
