import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/active-production", () => ({ getActiveProductionId: vi.fn() }));

import { firstConsent, photoConsentsForShow } from "../photo-consent-scope";

describe("photo-consent-scope", () => {
  it("filtert auf die Produktion und ignoriert widerrufene Erlaubnisse", () => {
    expect(photoConsentsForShow("show-1", { id: true })).toEqual({
      where: { showId: "show-1", revokedAt: null },
      take: 1,
      select: { id: true },
    });
  });

  it("findet ohne Produktion keine Erlaubnis", () => {
    expect(photoConsentsForShow(null, { id: true }).where).toEqual({ id: { in: [] } });
  });

  it("liefert den ersten Eintrag oder null", () => {
    expect(firstConsent([{ id: "a" }, { id: "b" }])).toEqual({ id: "a" });
    expect(firstConsent([])).toBeNull();
    expect(firstConsent(undefined)).toBeNull();
  });
});
