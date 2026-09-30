import { describe, expect, it } from "vitest";

import type { PhotoConsentPurposeRecord } from "../photo-consent-summary";
import {
  buildPhotoConsentPurposeSnapshot,
  derivePhotoConsentStatus,
  normalizePhotoConsentSelection,
} from "../photo-consent-submission";

const PURPOSES: PhotoConsentPurposeRecord[] = [
  {
    id: "p1",
    code: "internal",
    label: "Intern",
    description: null,
    appliesTo: "both",
    isRefusal: false,
    sortOrder: 0,
  },
  {
    id: "p2",
    code: "promo",
    label: "Werbung",
    description: null,
    appliesTo: "both",
    isRefusal: false,
    sortOrder: 1,
  },
  {
    id: "p3",
    code: "none",
    label: "Gar nicht",
    description: null,
    appliesTo: "both",
    isRefusal: true,
    sortOrder: 2,
  },
];

describe("normalizePhotoConsentSelection", () => {
  it("verwirft unbekannte IDs und setzt nicht gewählte Zwecke auf false", () => {
    const result = normalizePhotoConsentSelection(PURPOSES, [
      { purposeId: "p1", chosen: true },
      { purposeId: "unbekannt", chosen: true },
    ]);
    expect(result.isRefusal).toBe(false);
    expect(result.choices).toEqual([
      { purposeId: "p1", chosen: true },
      { purposeId: "p2", chosen: false },
      { purposeId: "p3", chosen: false },
    ]);
  });

  it("macht „gar nicht“ exklusiv", () => {
    const result = normalizePhotoConsentSelection(PURPOSES, [
      { purposeId: "p1", chosen: true },
      { purposeId: "p3", chosen: true },
    ]);
    expect(result.isRefusal).toBe(true);
    expect(result.choices).toEqual([
      { purposeId: "p1", chosen: false },
      { purposeId: "p2", chosen: false },
      { purposeId: "p3", chosen: true },
    ]);
  });
});

describe("derivePhotoConsentStatus", () => {
  it("gibt bei Ablehnung noPhotos, sonst pending", () => {
    expect(derivePhotoConsentStatus(true)).toBe("noPhotos");
    expect(derivePhotoConsentStatus(false)).toBe("pending");
  });
});

describe("buildPhotoConsentPurposeSnapshot", () => {
  it("hält die Auswahl in Sortierreihenfolge fest", () => {
    const snapshot = buildPhotoConsentPurposeSnapshot(PURPOSES, [
      { purposeId: "p3", chosen: true },
      { purposeId: "p1", chosen: true },
      { purposeId: "p2", chosen: false },
    ]);
    expect(snapshot).toEqual([
      { code: "internal", label: "Intern", chosen: true },
      { code: "promo", label: "Werbung", chosen: false },
      { code: "none", label: "Gar nicht", chosen: true },
    ]);
  });
});
