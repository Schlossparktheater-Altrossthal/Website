import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/active-production", () => ({ getActiveProduction: vi.fn() }));

import type { EntryView } from "../book";
import { centsForCsv, entriesToCsv, fundTotals, groupTotals } from "../report";

const entry = (over: Partial<EntryView>): EntryView => ({
  id: over.label ?? "x",
  number: 1,
  label: "S27-001",
  type: "income",
  amountCents: 1000,
  bookingDate: "2027-07-01",
  description: "Abendkasse",
  counterparty: null,
  fund: { id: "kasse", name: "Barkasse" },
  transferFund: null,
  category: { id: "c1", name: "Abendkasse" },
  department: null,
  source: "manual",
  donorName: null,
  donorAddress: null,
  locked: false,
  reversalOf: null,
  reversedBy: null,
  createdBy: "Kassenwart",
  receipts: [],
  ...over,
});

describe("Finanzberichte", () => {
  it("summiert je Kategorie und verrechnet Stornos", () => {
    const groups = groupTotals(
      [
        entry({ amountCents: 5000 }),
        entry({ type: "expense", amountCents: 1200, category: { id: "m", name: "Material" } }),
        entry({
          type: "income",
          amountCents: 1200,
          reversalOf: "S27-002",
          category: { id: "m", name: "Material" },
        }),
        entry({ type: "transfer", amountCents: 3000, transferFund: { id: "fv", name: "FV" } }),
      ],
      (row) => row.category?.name ?? "Ohne Kategorie",
    );
    expect(groups).toEqual([{ label: "Abendkasse", incomeCents: 5000, expenseCents: 0 }]);
  });

  it("rechnet Umbuchungen in die Töpfe", () => {
    expect(
      fundTotals([
        entry({ amountCents: 5000 }),
        entry({
          type: "transfer",
          amountCents: 3000,
          transferFund: { id: "fv", name: "Förderverein" },
        }),
      ]),
    ).toEqual([
      { name: "Barkasse", incomeCents: 5000, expenseCents: 3000, balanceCents: 2000 },
      { name: "Förderverein", incomeCents: 3000, expenseCents: 0, balanceCents: 3000 },
    ]);
  });

  it("schreibt CSV mit Semikolon, Komma-Beträgen und Schutz vor Formeln", () => {
    const csv = entriesToCsv([entry({ description: "=SUMME(A1)", amountCents: 123456 })]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [, line] = csv.trim().split("\r\n");
    expect(line).toContain('"01.07.2027";"Einnahme";"\'=SUMME(A1)"');
    expect(line).toContain('"1234,56";""');
    expect(centsForCsv(5)).toBe("0,05");
  });
});
