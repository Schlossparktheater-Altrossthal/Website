import { describe, expect, it } from "vitest";

import { CURRENT_PRIVACY_POLICY, PRIVACY_POLICY_VERSIONS } from "@/lib/datenschutz/policy";

describe("Datenschutzerklärung", () => {
  it("hat eindeutige Versionen, neueste zuerst", () => {
    const versions = PRIVACY_POLICY_VERSIONS.map((entry) => entry.version);
    expect(new Set(versions).size).toBe(versions.length);
    const dates = PRIVACY_POLICY_VERSIONS.map((entry) => entry.validFrom);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(CURRENT_PRIVACY_POLICY).toBe(PRIVACY_POLICY_VERSIONS[0]);
  });

  it("nennt für jede Fassung Änderungen und Abschnitte", () => {
    for (const entry of PRIVACY_POLICY_VERSIONS) {
      expect(entry.changes.length).toBeGreaterThan(0);
      expect(entry.sections.length).toBeGreaterThan(0);
    }
  });
});
