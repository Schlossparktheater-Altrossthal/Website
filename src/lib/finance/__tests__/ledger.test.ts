import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { formatCents, formatSignedCents, parseEuroToCents } from "@/lib/format/money";
import {
  FinanceError,
  fundBalances,
  isEntryLocked,
  reversedDirection,
  validateEntryInput,
} from "../ledger";
import { basePeriodCode, formatEntryNumber, nextFreePeriodCode } from "../periods";

const base = {
  periodId: "p",
  fundId: "fv",
  type: "expense" as const,
  amountCents: 1750,
  bookingDate: new Date("2026-10-20"),
  description: "Stoff",
};

describe("Geldbeträge", () => {
  it("liest deutsche und Punkt-Schreibweise", () => {
    expect(parseEuroToCents("12,50")).toBe(1250);
    expect(parseEuroToCents("1.234,5 €")).toBe(123450);
    expect(parseEuroToCents("12.50")).toBe(1250);
    expect(parseEuroToCents("1.200")).toBe(120000);
    expect(parseEuroToCents("0,1")).toBe(10);
    expect(parseEuroToCents("-3")).toBeNull();
    expect(parseEuroToCents("1,234")).toBeNull();
    expect(parseEuroToCents("")).toBeNull();
  });
  it("formatiert mit Vorzeichen", () => {
    expect(formatCents(1250)).toContain("12,50");
    expect(formatSignedCents(-1750)).toMatch(/^− 17,50/);
    expect(formatSignedCents(61200)).toMatch(/^\+ 612,00/);
  });
});

describe("Zeiträume", () => {
  it("vergibt Codes je Art und Jahr", () => {
    expect(basePeriodCode("production", 2027)).toBe("S27");
    expect(basePeriodCode("general", 2026)).toBe("A26");
    expect(nextFreePeriodCode("S27", new Set(["S27"]))).toBe("S27b");
    expect(nextFreePeriodCode("S27", new Set(["S27", "S27b"]))).toBe("S27c");
    expect(formatEntryNumber("S27", 41)).toBe("S27-041");
  });
});

describe("Buchungen", () => {
  it("prüft Betrag, Text und Umbuchungs-Topf", () => {
    expect(() => validateEntryInput(base)).not.toThrow();
    expect(() => validateEntryInput({ ...base, amountCents: 0 })).toThrow(FinanceError);
    expect(() => validateEntryInput({ ...base, amountCents: 12.5 })).toThrow(FinanceError);
    expect(() => validateEntryInput({ ...base, description: "  " })).toThrow(FinanceError);
    expect(() => validateEntryInput({ ...base, type: "transfer" })).toThrow(/Ziel-Topf/);
    expect(() => validateEntryInput({ ...base, type: "transfer", transferFundId: "fv" })).toThrow(
      /gleich/,
    );
    expect(() => validateEntryInput({ ...base, transferFundId: "kasse" })).toThrow(FinanceError);
  });

  it("dreht beim Storno die Richtung", () => {
    expect(reversedDirection({ type: "expense", fundId: "fv", transferFundId: null })).toEqual({
      type: "income",
      fundId: "fv",
      transferFundId: null,
    });
    expect(reversedDirection({ type: "transfer", fundId: "kasse", transferFundId: "fv" })).toEqual({
      type: "transfer",
      fundId: "fv",
      transferFundId: "kasse",
    });
  });

  it("rechnet Salden je Topf inkl. Umbuchung und Storno", () => {
    const balances = fundBalances([
      { type: "income", amountCents: 61200, fundId: "kasse", transferFundId: null },
      { type: "transfer", amountCents: 50000, fundId: "kasse", transferFundId: "fv" },
      { type: "expense", amountCents: 1750, fundId: "fv", transferFundId: null },
      { type: "income", amountCents: 1750, fundId: "fv", transferFundId: null },
    ]);
    expect(balances.get("kasse")).toBe(11200);
    expect(balances.get("fv")).toBe(50000);
  });

  it("erkennt festgeschriebene Nummern", () => {
    expect(isEntryLocked({ number: 30 }, 30)).toBe(true);
    expect(isEntryLocked({ number: 31 }, 30)).toBe(false);
  });
});
