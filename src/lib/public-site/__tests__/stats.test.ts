import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/email/send", () => ({ createConfiguredMailSender: vi.fn() }));

import { countProductionYears } from "../stats";

const now = new Date("2026-10-23T12:00:00Z");

describe("countProductionYears", () => {
  it("zählt vergangene Produktionen zur Chronik dazu", () => {
    expect(countProductionYears([2024, 2025], [{ year: 2026, hasUpcoming: false }], now)).toBe(3);
  });

  it("zählt kommende Saisons und Doppelungen nicht", () => {
    const shows = [
      { year: 2025, hasUpcoming: false },
      { year: 2027, hasUpcoming: true },
      { year: 2026, hasUpcoming: true },
    ];
    expect(countProductionYears([2024, 2025], shows, now)).toBe(2);
  });
});
