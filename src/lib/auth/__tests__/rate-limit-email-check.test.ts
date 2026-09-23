import { describe, expect, it } from "vitest";

import { recordOnboardingEmailCheck } from "../rate-limit";

describe("recordOnboardingEmailCheck", () => {
  it("erlaubt 10 Prüfungen pro Einladungssitzung und Stunde", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i += 1) {
      expect(recordOnboardingEmailCheck("session-a", "10.0.0.1", now).allowed).toBe(true);
    }
    const blocked = recordOnboardingEmailCheck("session-a", "10.0.0.1", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(3600);

    // Nach Ablauf der Stunde wieder frei.
    expect(recordOnboardingEmailCheck("session-a", "10.0.0.1", now + 3_600_001).allowed).toBe(true);
  });

  it("begrenzt zusätzlich pro IP", () => {
    const now = 5_000_000;
    for (let i = 0; i < 30; i += 1) {
      expect(recordOnboardingEmailCheck(`session-${i}`, "10.0.0.2", now).allowed).toBe(true);
    }
    expect(recordOnboardingEmailCheck("session-neu", "10.0.0.2", now).allowed).toBe(false);
  });
});
