import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { summarizePerformanceIncome } from "../income";

const reservation = (over: Partial<Parameters<typeof summarizePerformanceIncome>[0][number]>) => ({
  source: "online",
  status: "confirmed",
  paymentStatus: "open",
  totalCents: 1200,
  paidAtDoor: false,
  ...over,
});

describe("Einnahmen je Vorstellung", () => {
  it("trennt Abendkasse, an der Tür kassiert, Vorverkauf und offen", () => {
    const result = summarizePerformanceIncome(
      [
        reservation({ source: "box_office", paymentStatus: "paid", totalCents: 2400 }),
        reservation({ paymentStatus: "paid", paidAtDoor: true, totalCents: 1800 }),
        reservation({ source: "phone", paymentStatus: "paid", totalCents: 3000 }),
        reservation({ totalCents: 900 }),
        reservation({ status: "cancelled", paymentStatus: "paid", totalCents: 5000 }),
        reservation({ source: "free_ticket", paymentStatus: "free", totalCents: 0 }),
        reservation({ status: "pending", totalCents: 700 }),
      ],
      [],
    );
    expect(result).toMatchObject({
      boxOfficeCents: 2400,
      doorPaidCents: 1800,
      presaleCents: 3000,
      openCents: 900,
      expectedCashCents: 4200,
      presaleUnbookedCents: 3000,
    });
  });

  it("verrechnet gebuchte Einnahmen und Stornos je Quelle", () => {
    const result = summarizePerformanceIncome(
      [reservation({ source: "phone", paymentStatus: "paid", totalCents: 3000 })],
      [
        { type: "income", source: "tickets", amountCents: 2000, reversalOfId: null },
        { type: "income", source: "box_office", amountCents: 4000, reversalOfId: null },
        { type: "expense", source: "box_office", amountCents: 4000, reversalOfId: "a" },
        { type: "income", source: "box_office", amountCents: 4100, reversalOfId: null },
        { type: "income", source: "donation", amountCents: 500, reversalOfId: null },
      ],
    );
    expect(result.booked).toEqual({ boxOfficeCents: 4100, ticketsCents: 2000, donationCents: 500 });
    expect(result.presaleUnbookedCents).toBe(1000);
  });
});
