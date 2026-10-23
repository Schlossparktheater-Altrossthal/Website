import type { FinanceEntryType, Prisma } from "@prisma/client";

import { getActiveProduction } from "@/lib/active-production";
import { fundEffects } from "@/lib/finance/ledger";
import { ensureGeneralPeriod, ensureShowPeriod, formatEntryNumber } from "@/lib/finance/periods";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

/** Kassenbuch (docs/Plan/finanzen-plan.md, Phase 3): Abfragen und Ansichtsdaten. */

export type BookFilter = {
  periodId: string;
  fundId?: string | null;
  type?: FinanceEntryType | null;
  categoryId?: string | null;
  departmentId?: string | null;
  query?: string | null;
};

export type EntryView = {
  id: string;
  number: number;
  label: string;
  type: FinanceEntryType;
  amountCents: number;
  bookingDate: string;
  description: string;
  counterparty: string | null;
  fund: { id: string; name: string };
  transferFund: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  source: string;
  donorName: string | null;
  donorAddress: string | null;
  locked: boolean;
  reversalOf: string | null;
  reversedBy: string | null;
  createdBy: string;
  receipts: { id: string; filename: string; mimeType: string }[];
};

export type PeriodOption = {
  id: string;
  name: string;
  code: string;
  kind: "production" | "general";
  year: number;
};

/** Zeiträume zur Auswahl; legt den der aktiven Produktion und „Allgemein“ des Jahres bei Bedarf an. */
export async function loadPeriodOptions(
  userId: string,
): Promise<{ options: PeriodOption[]; defaultId: string }> {
  const production = await getActiveProduction(userId);
  const active = production ? await ensureShowPeriod(production.id) : null;
  const general = await ensureGeneralPeriod(new Date().getFullYear());
  const periods = await prisma.financePeriod.findMany({
    orderBy: [{ year: "desc" }, { kind: "asc" }, { code: "asc" }],
    select: { id: true, name: true, code: true, kind: true, year: true },
  });
  return { options: periods, defaultId: active?.id ?? general.id };
}

const entryInclude = {
  fund: { select: { id: true, name: true } },
  transferFund: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  reversalOf: { select: { number: true } },
  reversedBy: { select: { number: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
  receipts: { select: { id: true, filename: true, mimeType: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.FinanceEntryInclude;

export function bookWhere(filter: BookFilter): Prisma.FinanceEntryWhereInput {
  const query = filter.query?.trim();
  return {
    periodId: filter.periodId,
    ...(filter.fundId
      ? { OR: [{ fundId: filter.fundId }, { transferFundId: filter.fundId }] }
      : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
    ...(query
      ? {
          AND: [
            {
              OR: [
                { description: { contains: query, mode: "insensitive" as const } },
                { counterparty: { contains: query, mode: "insensitive" as const } },
                ...(/^\d+$/.test(query) ? [{ number: Number(query) }] : []),
              ],
            },
          ],
        }
      : {}),
  };
}

export async function loadBook(filter: BookFilter) {
  const period = await prisma.financePeriod.findUniqueOrThrow({ where: { id: filter.periodId } });
  const [rows, all] = await Promise.all([
    prisma.financeEntry.findMany({
      where: bookWhere(filter),
      include: entryInclude,
      orderBy: { number: "desc" },
    }),
    // Kennzahlen immer über den ganzen Zeitraum (ggf. je Topf), nicht über Suchtreffer.
    prisma.financeEntry.findMany({
      where: { periodId: filter.periodId },
      select: {
        type: true,
        amountCents: true,
        fundId: true,
        transferFundId: true,
        reversalOfId: true,
      },
    }),
  ]);
  const entries: EntryView[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    label: formatEntryNumber(period.code, row.number),
    type: row.type,
    amountCents: row.amountCents,
    bookingDate: row.bookingDate.toISOString().slice(0, 10),
    description: row.description,
    counterparty: row.counterparty,
    fund: row.fund,
    transferFund: row.transferFund,
    category: row.category,
    department: row.department,
    source: row.source,
    donorName: row.donorName,
    donorAddress: row.donorAddress,
    locked: row.number <= period.lockedThrough || Boolean(period.closedAt),
    reversalOf: row.reversalOf ? formatEntryNumber(period.code, row.reversalOf.number) : null,
    reversedBy: row.reversedBy ? formatEntryNumber(period.code, row.reversedBy.number) : null,
    createdBy: getUserDisplayName(row.createdBy),
    receipts: row.receipts,
  }));
  return { period, entries, totals: summarize(all, filter.fundId ?? null) };
}

export type BookTotals = { incomeCents: number; expenseCents: number; balanceCents: number };

/** Einnahmen/Ausgaben (ohne Umbuchungen, Stornos verrechnet) und Saldo; mit Topf zählen Umbuchungen in den Saldo. */
export function summarize(
  entries: {
    type: FinanceEntryType;
    amountCents: number;
    fundId: string;
    transferFundId: string | null;
    reversalOfId?: string | null;
  }[],
  fundId: string | null,
): BookTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  let balanceCents = 0;
  for (const entry of entries) {
    const touches = !fundId || entry.fundId === fundId || entry.transferFundId === fundId;
    if (!touches) continue;
    // Storno mindert die Summe der ursprünglichen Richtung, statt die Gegenrichtung aufzublähen.
    const reversal = Boolean(entry.reversalOfId);
    if (entry.type === "income") {
      if (reversal) expenseCents -= entry.amountCents;
      else incomeCents += entry.amountCents;
    }
    if (entry.type === "expense") {
      if (reversal) incomeCents -= entry.amountCents;
      else expenseCents += entry.amountCents;
    }
    for (const effect of fundEffects(entry)) {
      if (!fundId || effect.fundId === fundId) balanceCents += effect.cents;
    }
  }
  return { incomeCents, expenseCents, balanceCents };
}
