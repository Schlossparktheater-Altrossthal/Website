import type { FinanceEntryType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Budgets (docs/Plan/finanzen-plan.md, Phase 4): Soll je Zeitraum, optional eingeschränkt auf
 * Topf, Gewerk und Kategorie. Ist = Ausgaben, die zu allen gesetzten Merkmalen passen, abzüglich
 * Stornos. Offen = eingereichte/freigegebene Auslagen, die passen.
 */

type BudgetScope = {
  fundId: string | null;
  departmentId: string | null;
  categoryId: string | null;
};

type ExpenseLike = {
  type: FinanceEntryType;
  amountCents: number;
  fundId: string;
  departmentId: string | null;
  categoryId: string | null;
  /** Gesetzt bei Stornobuchungen. */
  reversalOfId?: string | null;
};

type ClaimLike = {
  amountCents: number;
  fundId: string | null;
  departmentId: string | null;
  categoryId: string | null;
};

function matches(
  scope: BudgetScope,
  item: { fundId: string | null; departmentId: string | null; categoryId: string | null },
) {
  return (
    (!scope.fundId || item.fundId === scope.fundId) &&
    (!scope.departmentId || item.departmentId === scope.departmentId) &&
    (!scope.categoryId || item.categoryId === scope.categoryId)
  );
}

/** Ausgegeben in Cent: Ausgaben minus Stornos von Ausgaben (= Einnahmen mit `reversalOfId`). */
export function spentForScope(scope: BudgetScope, entries: ExpenseLike[]): number {
  let cents = 0;
  for (const entry of entries) {
    if (!matches(scope, entry)) continue;
    if (entry.type === "expense" && !entry.reversalOfId) cents += entry.amountCents;
    if (entry.type === "income" && entry.reversalOfId) cents -= entry.amountCents;
  }
  return cents;
}

/** Offene Auslagen; ohne gewählten Topf zählen sie für jeden Topf-Filter mit (noch nicht zugeordnet). */
export function openClaimsForScope(scope: BudgetScope, claims: ClaimLike[]): number {
  return claims
    .filter((claim) => matches({ ...scope, fundId: claim.fundId ? scope.fundId : null }, claim))
    .reduce((sum, claim) => sum + claim.amountCents, 0);
}

export type BudgetView = {
  id: string;
  label: string;
  fund: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  plannedCents: number;
  spentCents: number;
  openCents: number;
  notes: string | null;
};

export function budgetLabel(budget: Pick<BudgetView, "department" | "category" | "fund">) {
  const parts = [budget.department?.name, budget.category?.name].filter(Boolean);
  const label = parts.length ? parts.join(" · ") : "Gesamt";
  return budget.fund ? `${label} (${budget.fund.name})` : label;
}

async function loadInputs(periodId: string) {
  return Promise.all([
    prisma.financeEntry.findMany({
      where: { periodId, type: { in: ["expense", "income"] } },
      select: {
        type: true,
        amountCents: true,
        fundId: true,
        departmentId: true,
        categoryId: true,
        reversalOfId: true,
      },
    }),
    prisma.expenseClaim.findMany({
      where: { periodId, status: { in: ["submitted", "approved"] } },
      select: { amountCents: true, fundId: true, departmentId: true, categoryId: true },
    }),
  ]);
}

export async function loadBudgets(periodId: string, departmentId?: string): Promise<BudgetView[]> {
  const [budgets, [entries, claims]] = await Promise.all([
    prisma.financeBudget.findMany({
      where: { periodId, ...(departmentId ? { departmentId } : {}) },
      include: {
        fund: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, sortOrder: true } },
        category: { select: { id: true, name: true } },
      },
    }),
    loadInputs(periodId),
  ]);
  return budgets
    .map((budget) => {
      const view = {
        id: budget.id,
        fund: budget.fund,
        department: budget.department
          ? { id: budget.department.id, name: budget.department.name }
          : null,
        category: budget.category,
        plannedCents: budget.plannedCents,
        spentCents: spentForScope(budget, entries),
        openCents: openClaimsForScope(budget, claims),
        notes: budget.notes,
      };
      return {
        view: { ...view, label: budgetLabel(view) },
        sort: budget.department?.sortOrder ?? -1,
      };
    })
    .sort((a, b) => a.sort - b.sort || a.view.label.localeCompare(b.view.label, "de"))
    .map((entry) => entry.view);
}

/** Für den Budget-Tab im Gewerk: Budgets, Ausgaben und geschätzte Objektkosten des Gewerks. */
export async function loadDepartmentFinance(showId: string, departmentId: string) {
  const period = await prisma.financePeriod.findUnique({ where: { showId } });
  const [budgets, expenses, objects] = await Promise.all([
    period ? loadBudgets(period.id, departmentId) : [],
    period
      ? prisma.financeEntry.findMany({
          where: { periodId: period.id, departmentId, type: "expense", reversalOfId: null },
          select: {
            id: true,
            number: true,
            description: true,
            amountCents: true,
            bookingDate: true,
            reversedBy: { select: { id: true } },
          },
          orderBy: { bookingDate: "desc" },
          take: 50,
        })
      : [],
    prisma.productionObject.findMany({
      where: { departmentId, archivedAt: null, costCents: { not: null } },
      select: {
        id: true,
        title: true,
        costCents: true,
        financeEntries: { select: { amountCents: true } },
      },
      orderBy: { title: "asc" },
    }),
  ]);
  return {
    periodCode: period?.code ?? null,
    budgets,
    expenses: expenses.map((entry) => ({
      id: entry.id,
      number: entry.number,
      description: entry.description,
      amountCents: entry.amountCents,
      bookingDate: entry.bookingDate.toISOString().slice(0, 10),
      reversed: Boolean(entry.reversedBy),
    })),
    objects: objects.map((object) => ({
      id: object.id,
      title: object.title,
      estimatedCents: object.costCents ?? 0,
      bookedCents: object.financeEntries.reduce((sum, entry) => sum + entry.amountCents, 0),
    })),
  };
}
