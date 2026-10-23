import type { FinanceEntry, FinanceEntrySource, FinanceEntryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCE_LIMITS } from "@/lib/finance/constants";

type Tx = Prisma.TransactionClient;

export class FinanceError extends Error {}

export type NewEntryInput = {
  periodId: string;
  fundId: string;
  transferFundId?: string | null;
  type: FinanceEntryType;
  amountCents: number;
  bookingDate: Date;
  description: string;
  counterparty?: string | null;
  categoryId?: string | null;
  departmentId?: string | null;
  objectId?: string | null;
  performanceEventId?: string | null;
  source?: FinanceEntrySource;
  donorName?: string | null;
  donorAddress?: string | null;
};

export function validateEntryInput(input: NewEntryInput): void {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new FinanceError("Betrag muss größer als 0 sein.");
  }
  if (input.amountCents > FINANCE_LIMITS.maxAmountCents) {
    throw new FinanceError("Betrag ist unplausibel hoch.");
  }
  const description = input.description.trim();
  if (!description) throw new FinanceError("Buchungstext fehlt.");
  if (description.length > FINANCE_LIMITS.description)
    throw new FinanceError("Buchungstext ist zu lang.");
  if (input.type === "transfer") {
    if (!input.transferFundId) throw new FinanceError("Umbuchung braucht einen Ziel-Topf.");
    if (input.transferFundId === input.fundId)
      throw new FinanceError("Quell- und Ziel-Topf sind gleich.");
  } else if (input.transferFundId) {
    throw new FinanceError("Ziel-Topf gibt es nur bei Umbuchungen.");
  }
}

/** Nächste Buchungsnummer des Zeitraums ziehen (Zeilensperre über das UPDATE). */
async function takeNumber(tx: Tx, periodId: string): Promise<number> {
  const period = await tx.financePeriod.update({
    where: { id: periodId },
    data: { nextNumber: { increment: 1 } },
    select: { nextNumber: true, closedAt: true },
  });
  if (period.closedAt) throw new FinanceError("Der Zeitraum ist abgeschlossen.");
  return period.nextNumber - 1;
}

/** Buchung anlegen; erhält die nächste fortlaufende Nummer des Zeitraums. */
export async function createEntryInTx(
  tx: Tx,
  input: NewEntryInput,
  actorId: string,
): Promise<FinanceEntry> {
  validateEntryInput(input);
  const number = await takeNumber(tx, input.periodId);
  const entry = await tx.financeEntry.create({
    data: {
      periodId: input.periodId,
      number,
      fundId: input.fundId,
      transferFundId: input.type === "transfer" ? input.transferFundId : null,
      type: input.type,
      amountCents: input.amountCents,
      bookingDate: input.bookingDate,
      description: input.description.trim(),
      counterparty: input.counterparty?.trim() || null,
      categoryId: input.type === "transfer" ? null : (input.categoryId ?? null),
      departmentId: input.departmentId ?? null,
      objectId: input.objectId ?? null,
      performanceEventId: input.performanceEventId ?? null,
      source: input.source ?? "manual",
      donorName: input.donorName?.trim() || null,
      donorAddress: input.donorAddress?.trim() || null,
      createdById: actorId,
    },
  });
  await tx.financeLog.create({ data: { entryId: entry.id, actorId, action: "created" } });
  return entry;
}

export function createEntry(input: NewEntryInput, actorId: string) {
  return prisma.$transaction((tx) => createEntryInTx(tx, input, actorId));
}

export function isEntryLocked(entry: Pick<FinanceEntry, "number">, lockedThrough: number): boolean {
  return entry.number <= lockedThrough;
}

/** Felder einer nicht festgeschriebenen Buchung ändern. Betrag/Typ/Topf bleiben änderbar, Nummer nie. */
export async function updateEntry(
  entryId: string,
  patch: Partial<Omit<NewEntryInput, "periodId" | "source">>,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.financeEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: {
        period: { select: { lockedThrough: true, closedAt: true } },
        reversedBy: { select: { id: true } },
      },
    });
    if (entry.period.closedAt || isEntryLocked(entry, entry.period.lockedThrough)) {
      throw new FinanceError("Buchung ist festgeschrieben – bitte stornieren.");
    }
    if (entry.reversalOfId || entry.reversedBy) {
      throw new FinanceError("Stornierte Buchungen und Stornobuchungen sind nicht änderbar.");
    }
    const merged: NewEntryInput = {
      periodId: entry.periodId,
      fundId: patch.fundId ?? entry.fundId,
      transferFundId:
        patch.transferFundId !== undefined ? patch.transferFundId : entry.transferFundId,
      type: patch.type ?? entry.type,
      amountCents: patch.amountCents ?? entry.amountCents,
      bookingDate: patch.bookingDate ?? entry.bookingDate,
      description: patch.description ?? entry.description,
      counterparty: patch.counterparty !== undefined ? patch.counterparty : entry.counterparty,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : entry.categoryId,
      departmentId: patch.departmentId !== undefined ? patch.departmentId : entry.departmentId,
      objectId: patch.objectId !== undefined ? patch.objectId : entry.objectId,
      performanceEventId:
        patch.performanceEventId !== undefined
          ? patch.performanceEventId
          : entry.performanceEventId,
      donorName: patch.donorName !== undefined ? patch.donorName : entry.donorName,
      donorAddress: patch.donorAddress !== undefined ? patch.donorAddress : entry.donorAddress,
    };
    validateEntryInput(merged);
    const updated = await tx.financeEntry.update({
      where: { id: entryId },
      data: {
        fundId: merged.fundId,
        transferFundId: merged.type === "transfer" ? merged.transferFundId : null,
        type: merged.type,
        amountCents: merged.amountCents,
        bookingDate: merged.bookingDate,
        description: merged.description.trim(),
        counterparty: merged.counterparty?.trim() || null,
        categoryId: merged.type === "transfer" ? null : (merged.categoryId ?? null),
        departmentId: merged.departmentId ?? null,
        objectId: merged.objectId ?? null,
        performanceEventId: merged.performanceEventId ?? null,
        donorName: merged.donorName?.trim() || null,
        donorAddress: merged.donorAddress?.trim() || null,
      },
    });
    await tx.financeLog.create({
      data: { entryId, actorId, action: "updated", data: patch as Prisma.InputJsonValue },
    });
    return updated;
  });
}

/** Storno: Gegenbuchung mit gleichem Betrag und umgekehrter Richtung, neue Nummer. */
export async function reverseEntry(
  entryId: string,
  actorId: string,
  reason: string,
  bookingDate = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.financeEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { reversedBy: { select: { id: true } } },
    });
    if (entry.reversalOfId)
      throw new FinanceError("Eine Stornobuchung kann nicht storniert werden.");
    if (entry.reversedBy) throw new FinanceError("Buchung ist bereits storniert.");
    const reversed = reversedDirection(entry);
    const number = await takeNumber(tx, entry.periodId);
    const reversal = await tx.financeEntry.create({
      data: {
        periodId: entry.periodId,
        number,
        fundId: reversed.fundId,
        transferFundId: reversed.transferFundId,
        type: reversed.type,
        amountCents: entry.amountCents,
        bookingDate,
        description: `Storno: ${reason.trim() || entry.description}`.slice(
          0,
          FINANCE_LIMITS.description,
        ),
        counterparty: entry.counterparty,
        categoryId: entry.categoryId,
        departmentId: entry.departmentId,
        objectId: entry.objectId,
        performanceEventId: entry.performanceEventId,
        source: entry.source,
        reversalOfId: entry.id,
        createdById: actorId,
      },
    });
    await tx.financeLog.createMany({
      data: [
        {
          entryId: entry.id,
          actorId,
          action: "reversed",
          data: { reversalId: reversal.id, reason },
        },
        { entryId: reversal.id, actorId, action: "created", data: { reversalOf: entry.id } },
      ],
    });
    return reversal;
  });
}

/** Richtung einer Stornobuchung: Einnahme ↔ Ausgabe, Umbuchung mit getauschten Töpfen. */
export function reversedDirection(entry: Pick<FinanceEntry, "type" | "fundId" | "transferFundId">) {
  if (entry.type === "transfer") {
    return {
      type: "transfer" as const,
      fundId: entry.transferFundId!,
      transferFundId: entry.fundId,
    };
  }
  return {
    type: entry.type === "income" ? ("expense" as const) : ("income" as const),
    fundId: entry.fundId,
    transferFundId: null,
  };
}

/** Buchungen bis einschließlich `throughNumber` festschreiben (nur vorwärts). */
export async function lockPeriodThrough(periodId: string, throughNumber: number, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const period = await tx.financePeriod.findUniqueOrThrow({ where: { id: periodId } });
    const max = period.nextNumber - 1;
    if (throughNumber <= period.lockedThrough) return period;
    if (throughNumber > max) throw new FinanceError("Diese Buchungsnummer gibt es noch nicht.");
    const updated = await tx.financePeriod.update({
      where: { id: periodId },
      data: { lockedThrough: throughNumber },
    });
    await tx.financeLog.create({
      data: { actorId, action: "period_locked", data: { periodId, throughNumber } },
    });
    return updated;
  });
}

type SignedInput = Pick<FinanceEntry, "type" | "amountCents" | "fundId" | "transferFundId">;

/** Wirkung einer Buchung auf die Töpfe (Cent, + = Zufluss). */
export function fundEffects(entry: SignedInput): { fundId: string; cents: number }[] {
  if (entry.type === "income") return [{ fundId: entry.fundId, cents: entry.amountCents }];
  if (entry.type === "expense") return [{ fundId: entry.fundId, cents: -entry.amountCents }];
  return [
    { fundId: entry.fundId, cents: -entry.amountCents },
    { fundId: entry.transferFundId!, cents: entry.amountCents },
  ];
}

/** Salden je Topf aus einer Buchungsliste. */
export function fundBalances(entries: SignedInput[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const entry of entries) {
    for (const effect of fundEffects(entry)) {
      balances.set(effect.fundId, (balances.get(effect.fundId) ?? 0) + effect.cents);
    }
  }
  return balances;
}
