import { describe, expect, it } from "vitest";

import {
  isPhotoConsentLevel,
  isPhotoConsentLevelAllowed,
  photoConsentLevelFromPurposeCodes,
  photoConsentLevelsFor,
  photoConsentStatusForLevel,
} from "@/lib/photo-consent-levels";

describe("photo consent levels", () => {
  it("offers the on-request level only to adults", () => {
    expect(photoConsentLevelsFor(false)).toEqual(["all", "promoOnRequest", "internal", "none"]);
    expect(photoConsentLevelsFor(true)).toEqual(["all", "internal", "none"]);
    expect(isPhotoConsentLevelAllowed("promoOnRequest", true)).toBe(false);
  });

  it("validates level strings", () => {
    expect(isPhotoConsentLevel("internal")).toBe(true);
    expect(isPhotoConsentLevel("promo")).toBe(false);
    expect(isPhotoConsentLevel(null)).toBe(false);
  });

  it("makes only the refusal immediately effective", () => {
    expect(photoConsentStatusForLevel("none")).toBe("noPhotos");
    expect(photoConsentStatusForLevel("all")).toBe("pending");
  });

  it("maps legacy purpose choices like the migration", () => {
    expect(photoConsentLevelFromPurposeCodes(["internal", "promo"])).toBe("all");
    expect(photoConsentLevelFromPurposeCodes(["internal"])).toBe("internal");
    expect(photoConsentLevelFromPurposeCodes(["promo_on_request"])).toBe("promoOnRequest");
    expect(photoConsentLevelFromPurposeCodes(["promo", "none"])).toBe("none");
    expect(photoConsentLevelFromPurposeCodes([], "noPhotos")).toBe("none");
    expect(photoConsentLevelFromPurposeCodes([])).toBeNull();
  });
});
