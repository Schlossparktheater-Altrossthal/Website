import { describe, expect, it } from "vitest";

import { checkPhotoConsentSubmission } from "@/lib/photo-consent-submission";

const base = {
  level: "all" as const,
  isMinor: false,
  hasDateOfBirth: true,
  hasNewProof: false,
  hasExistingProof: false,
  deferProof: false,
};

describe("checkPhotoConsentSubmission", () => {
  it("accepts a refusal without birth date or proof", () => {
    expect(
      checkPhotoConsentSubmission({ ...base, level: "none", hasDateOfBirth: false, isMinor: null }),
    ).toBeNull();
  });

  it("requires a birth date for every other level", () => {
    expect(checkPhotoConsentSubmission({ ...base, hasDateOfBirth: false, isMinor: null })).toMatch(
      /Geburtsdatum/,
    );
  });

  it("requires proof per production, also for adults", () => {
    expect(checkPhotoConsentSubmission(base)).toMatch(/unterschreibe/);
    expect(checkPhotoConsentSubmission({ ...base, hasNewProof: true })).toBeNull();
    expect(checkPhotoConsentSubmission({ ...base, hasExistingProof: true })).toBeNull();
  });

  it("lets only minors defer the parental proof", () => {
    expect(checkPhotoConsentSubmission({ ...base, deferProof: true })).not.toBeNull();
    expect(checkPhotoConsentSubmission({ ...base, isMinor: true, deferProof: true })).toBeNull();
  });

  it("rejects the on-request level for minors", () => {
    expect(
      checkPhotoConsentSubmission({
        ...base,
        level: "promoOnRequest",
        isMinor: true,
        hasNewProof: true,
      }),
    ).toMatch(/Volljährige/);
  });
});
