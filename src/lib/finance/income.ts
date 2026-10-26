import type { FinanceEntrySource, FinanceEntryType, Prisma } from "@prisma/client";

import { FinanceError, createEntryInTx } from "@/lib/finance/ledger";
import { ensureShowPeriod } from "@/lib/finance/periods";
import { formatDate } from "@/lib/format/date";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

/** Einnahmen je Vorstellung (docs/Plan/finanzen-plan.md, Phase 5): Kartenbuchung gegen Kassenbuch. */

type Tx = Prisma.TransactionClient;

/** Kennzeichen der Einlass-Aktion „pay“ in `ReservationCheckIn.deviceLabel` (lib/karten/checkin.ts). */
const DOOR_PAYMENT_LABEL = "Zahlung";

export type IncomeReservation = {
  source: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  /** An der Tür kassiert (Einlass-Aktion „pay“). */
  paidAtDoor: boolean;
};

export type IncomeEntry = {
  type: FinanceEntryType;
  source: FinanceEntrySource;
  amountCents: number;
  reversalOfId: string | null;
};

export type PerformanceIncome = {
  /** Verkäufe an der Abendkasse. */
  boxOfficeCents: number;
  /** Reservierungen, deren offener Betrag an der Tür kassiert wurde. */
  doorPaidCents: number;
  /** Vorab bezahlt (Kartenbüro). */
  presaleCents: number;
  /** Bestätigt, aber noch nicht bezahlt. */
  openCents: number;
  /** Bargeld, das nach der Vorstellung in der Kasse sein sollte. */
  expectedCashCents: number;
  booked: { boxOfficeCents: number; ticketsCents: number; donationCents: number };
  /** Vorverkauf, der noch nicht im Kassenbuch steht. */
  presaleUnbookedCents: number;
};

const ACTIVE = new Set(["confirmed", "pending"]);

export function summarizePerformanceIncome(
  reservations: IncomeReservation[],
  entries: IncomeEntry[],
): PerformanceIncome {
  let boxOfficeCents = 0;
  let doorPaidCents = 0;
  let presaleCents = 0;
  let openCents = 0;
  for (const reservation of reservations) {
    if (!ACTIVE.has(reservation.status) || reservation.totalCents <= 0) continue;
    if (reservation.source === "box_office") boxOfficeCents += reservation.totalCents;
    else if (reservation.paymentStatus === "paid") {
      if (reservation.paidAtDoor) doorPaidCents += reservation.totalCents;
      else presaleCents += reservation.totalCents;
    } else if (reservation.paymentStatus === "open" && reservation.status === "confirmed") {
      openCents += reservation.totalCents;
    }
  }
  const booked = { boxOfficeCents: 0, ticketsCents: 0, donationCents: 0 };
  for (const entry of entries) {
    if (entry.type === "transfer") continue;
    // Einnahme zählt, ihr Storno (Ausgabe mit reversalOfId) zieht wieder ab.
    const sign = entry.type === "income" ? 1 : entry.reversalOfId ? -1 : 0;
    const cents = sign * entry.amountCents;
    if (entry.source === "box_office") booked.boxOfficeCents += cents;
    if (entry.source === "tickets") booked.ticketsCents += cents;
    if (entry.source === "donation") booked.donationCents += cents;
  }
  return {
    boxOfficeCents,
    doorPaidCents,
    presaleCents,
    openCents,
    expectedCashCents: boxOfficeCents + doorPaidCents,
    booked,
    presaleUnbookedCents: Math.max(0, presaleCents - booked.ticketsCents),
  };
}

export type CashCountView = {
  id: string;
  countedCents: number;
  expectedCents: number;
  notes: string | null;
  fundName: string;
  countedBy: string;
  createdAt: string;
};

export type PerformanceIncomeView = PerformanceIncome & {
  eventId: string;
  title: string;
  start: string;
  cancelled: boolean;
  tickets: number;
  cashCounts: CashCountView[];
};

export async function loadPerformanceIncome(showId: string): Promise<PerformanceIncomeView[]> {
  const events = await prisma.calendarEvent.findMany({
    where: { showId, kind: "PERFORMANCE", status: { not: "DRAFT" } },
    orderBy: { start: "asc" },
    select: {
      id: true,
      title: true,
      start: true,
      status: true,
      reservations: {
        select: {
          source: true,
          status: true,
          paymentStatus: true,
          totalCents: true,
          items: { select: { quantity: true } },
          checkIns: {
            where: { delta: 0, deviceLabel: { startsWith: DOOR_PAYMENT_LABEL } },
            select: { id: true },
            take: 1,
          },
        },
      },
      financeEntries: {
        select: { type: true, source: true, amountCents: true, reversalOfId: true },
      },
      cashCounts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          countedCents: true,
          expectedCents: true,
          notes: true,
          createdAt: true,
          fund: { select: { name: true } },
          countedBy: { select: { firstName: true, lastName: true, name: true, email: true } },
        },
      },
    },
  });
  return events.map((event) => {
    const reservations = event.reservations.map((reservation) => ({
      source: reservation.source,
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
      totalCents: reservation.totalCents,
      paidAtDoor: reservation.checkIns.length > 0,
    }));
    return {
      eventId: event.id,
      title: event.title,
      start: event.start.toISOString(),
      cancelled: event.status === "CANCELLED",
      tickets: event.reservations
        .filter((reservation) => ACTIVE.has(reservation.status))
        .reduce(
          (sum, reservation) =>
            sum + reservation.items.reduce((acc, item) => acc + item.quantity, 0),
          0,
        ),
      ...summarizePerformanceIncome(reservations, event.financeEntries),
      cashCounts: event.cashCounts.map((count) => ({
        id: count.id,
        countedCents: count.countedCents,
        expectedCents: count.expectedCents,
        notes: count.notes,
        fundName: count.fund.name,
        countedBy: getUserDisplayName(count.countedBy),
        createdAt: count.createdAt.toISOString(),
      })),
    };
  });
}

async function loadPerformance(tx: Tx, eventId: string) {
  const event = await tx.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, kind: true, showId: true, start: true },
  });
  if (!event || event.kind !== "PERFORMANCE" || !event.showId) {
    throw new FinanceError("Vorstellung nicht gefunden.");
  }
  return { ...event, showId: event.showId, dateLabel: formatDate(event.start) ?? "" };
}

async function incomeCategoryId(tx: Tx, name: string) {
  const category = await tx.financeCategory.findFirst({
    where: { type: "income", name, archivedAt: null },
    select: { id: true },
  });
  return category?.id ?? null;
}

async function currentIncome(tx: Tx, eventId: string) {
  const event = await tx.calendarEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      reservations: {
        select: {
          source: true,
          status: true,
          paymentStatus: true,
          totalCents: true,
          checkIns: {
            where: { delta: 0, deviceLabel: { startsWith: DOOR_PAYMENT_LABEL } },
            select: { id: true },
            take: 1,
          },
        },
      },
      financeEntries: {
        select: { type: true, source: true, amountCents: true, reversalOfId: true },
      },
    },
  });
  return summarizePerformanceIncome(
    event.reservations.map((reservation) => ({
      ...reservation,
      paidAtDoor: reservation.checkIns.length > 0,
    })),
    event.financeEntries,
  );
}

/** Kassensturz nach der Vorstellung: gezählten Betrag als Einnahme „Abendkasse“ buchen. */
export async function recordCashCount(
  input: { eventId: string; fundId: string; countedCents: number; notes?: string | null },
  actorId: string,
) {
  if (!Number.isInteger(input.countedCents) || input.countedCents < 0) {
    throw new FinanceError("Gezählter Betrag fehlt.");
  }
  return prisma.$transaction(async (tx) => {
    const event = await loadPerformance(tx, input.eventId);
    const income = await currentIncome(tx, event.id);
    const period = await ensureShowPeriod(event.showId, tx);
    const difference = input.countedCents - income.expectedCashCents;
    const entry =
      input.countedCents > 0
        ? await createEntryInTx(
            tx,
            {
              periodId: period.id,
              fundId: input.fundId,
              type: "income",
              amountCents: input.countedCents,
              bookingDate: event.start,
              description: `Abendkasse ${event.dateLabel} (Kassensturz)`,
              categoryId: await incomeCategoryId(tx, "Abendkasse"),
              performanceEventId: event.id,
              source: "box_office",
            },
            actorId,
          )
        : null;
    const notes = input.notes?.trim().slice(0, 1000) || null;
    const count = await tx.cashCount.create({
      data: {
        eventId: event.id,
        fundId: input.fundId,
        countedCents: input.countedCents,
        expectedCents: income.expectedCashCents,
        notes,
        entryId: entry?.id ?? null,
        countedById: actorId,
      },
    });
    if (entry) {
      await tx.financeLog.create({
        data: {
          entryId: entry.id,
          actorId,
          action: "cash_count",
          data: { cashCountId: count.id, expectedCents: income.expectedCashCents, difference },
        },
      });
    }
    return count;
  });
}

/** Vorab bezahlte Karten einer Vorstellung, die noch nicht im Kassenbuch stehen, buchen. */
export async function bookPresale(input: { eventId: string; fundId: string }, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const event = await loadPerformance(tx, input.eventId);
    const income = await currentIncome(tx, event.id);
    if (income.presaleUnbookedCents <= 0) {
      throw new FinanceError("Kein ungebuchter Vorverkauf für diese Vorstellung.");
    }
    const period = await ensureShowPeriod(event.showId, tx);
    return createEntryInTx(
      tx,
      {
        periodId: period.id,
        fundId: input.fundId,
        type: "income",
        amountCents: income.presaleUnbookedCents,
        bookingDate: new Date(),
        description: `Vorverkauf Vorstellung ${event.dateLabel}`,
        categoryId: await incomeCategoryId(tx, "Kartenverkauf"),
        performanceEventId: event.id,
        source: "tickets",
      },
      actorId,
    );
  });
}

/** Spende mit Vorstellungsbezug (z. B. Spendenkasse am Ausgang). */
export async function recordDonation(
  input: {
    eventId: string;
    fundId: string;
    amountCents: number;
    donorName?: string | null;
    donorAddress?: string | null;
  },
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const event = await loadPerformance(tx, input.eventId);
    const period = await ensureShowPeriod(event.showId, tx);
    const donor = input.donorName?.trim();
    return createEntryInTx(
      tx,
      {
        periodId: period.id,
        fundId: input.fundId,
        type: "income",
        amountCents: input.amountCents,
        bookingDate: event.start,
        description: donor
          ? `Spende ${donor} (Vorstellung ${event.dateLabel})`
          : `Spenden Vorstellung ${event.dateLabel}`,
        counterparty: donor || null,
        categoryId: await incomeCategoryId(tx, "Spenden"),
        performanceEventId: event.id,
        source: "donation",
        donorName: donor || null,
        donorAddress: input.donorAddress,
      },
      actorId,
    );
  });
}
