import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/active-production", () => ({ getActiveProduction: vi.fn() }));

import { bookWhere, summarize } from "../book";

const entries = [
  { type: "income" as const, amountCents: 61200, fundId: "kasse", transferFundId: null },
  { type: "transfer" as const, amountCents: 50000, fundId: "kasse", transferFundId: "fv" },
  { type: "expense" as const, amountCents: 1750, fundId: "fv", transferFundId: null },
  // Storno der Ausgabe
  {
    type: "income" as const,
    amountCents: 1750,
    fundId: "fv",
    transferFundId: null,
    reversalOfId: "x",
  },
  { type: "expense" as const, amountCents: 16160, fundId: "fv", transferFundId: null },
];

describe("Kassenbuch-Kennzahlen", () => {
  it("verrechnet Stornos und lässt Umbuchungen aus Einnahmen/Ausgaben", () => {
    expect(summarize(entries, null)).toEqual({
      incomeCents: 61200,
      expenseCents: 16160,
      balanceCents: 45040,
    });
  });
  it("rechnet Umbuchungen in den Saldo eines Topfs", () => {
    expect(summarize(entries, "fv")).toEqual({
      incomeCents: 0,
      expenseCents: 16160,
      balanceCents: 33840,
    });
    expect(summarize(entries, "kasse").balanceCents).toBe(11200);
  });
});

describe("Kassenbuch-Filter", () => {
  it("findet Topf als Quelle oder Ziel und Nummern per Suche", () => {
    const where = bookWhere({ periodId: "p", fundId: "fv", query: "41" });
    expect(where.OR).toEqual([{ fundId: "fv" }, { transferFundId: "fv" }]);
    expect(JSON.stringify(where.AND)).toContain('"number":41');
  });
});
