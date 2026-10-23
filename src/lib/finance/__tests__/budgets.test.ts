import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { budgetLabel, openClaimsForScope, spentForScope } from "../budgets";

const entry = (overrides: Partial<Parameters<typeof spentForScope>[1][number]>) => ({
  type: "expense" as const,
  amountCents: 1000,
  fundId: "fv",
  departmentId: "bau",
  categoryId: "material",
  reversalOfId: null,
  ...overrides,
});

describe("Budget Soll/Ist", () => {
  const entries = [
    entry({}),
    entry({ amountCents: 500, categoryId: "verpflegung" }),
    entry({ amountCents: 200, departmentId: "kostuem" }),
    entry({ type: "income", amountCents: 1000, reversalOfId: "x" }), // Storno der ersten
    entry({ type: "income", amountCents: 9999, reversalOfId: null }), // normale Einnahme zählt nicht
    entry({ amountCents: 300, fundId: "schule" }),
  ];

  it("zählt nur passende Ausgaben und verrechnet Stornos", () => {
    expect(spentForScope({ fundId: null, departmentId: "bau", categoryId: null }, entries)).toBe(
      800,
    );
    expect(
      spentForScope({ fundId: "fv", departmentId: "bau", categoryId: "material" }, entries),
    ).toBe(0);
    expect(spentForScope({ fundId: null, departmentId: null, categoryId: null }, entries)).toBe(
      1000,
    );
  });

  it("rechnet offene Auslagen ohne Topf jedem Topf-Budget zu", () => {
    const claims = [
      { amountCents: 2380, fundId: null, departmentId: "bau", categoryId: null },
      { amountCents: 100, fundId: "schule", departmentId: "bau", categoryId: null },
    ];
    expect(
      openClaimsForScope({ fundId: "fv", departmentId: "bau", categoryId: null }, claims),
    ).toBe(2380);
    expect(
      openClaimsForScope({ fundId: null, departmentId: "bau", categoryId: null }, claims),
    ).toBe(2480);
  });

  it("beschriftet Budgets lesbar", () => {
    expect(
      budgetLabel({ department: { id: "b", name: "Bühnenbau" }, category: null, fund: null }),
    ).toBe("Bühnenbau");
    expect(
      budgetLabel({ department: null, category: null, fund: { id: "f", name: "Schule" } }),
    ).toBe("Gesamt (Schule)");
  });
});
