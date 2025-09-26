import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { mapFinanceBudget, resolveAllowedVisibilityScopes, type FinanceBudgetWithMeta } from "../utils";

const budgetSchema = z.object({
  category: z.string().min(2).max(120),
  plannedAmount: z.number().finite().nonnegative(),
  currency: z.string().trim().min(1).max(10).default("EUR"),
  notes: z.string().max(400).optional().nullable(),
  showId: z.string().min(1, "Produktion auswählen"),
});

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const [canView, canApprove] = await Promise.all([
    hasPermission(session.user, "mitglieder.finanzen"),
    hasPermission(session.user, "mitglieder.finanzen.approve"),
  ]);

  if (!canView) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const allowedScopes = resolveAllowedVisibilityScopes(session.user, canApprove);

  const showIdRaw = request.nextUrl.searchParams.get("showId");
  const showId = typeof showIdRaw === "string" ? showIdRaw.trim() : "";

  if (!showId) {
    return NextResponse.json({ error: "Produktion erforderlich" }, { status: 400 });
  }

  const budgetsRaw = await prisma.financeBudget.findMany({
    where: { showId },
    orderBy: [{ category: "asc" }],
    include: { show: { select: { id: true, title: true, year: true } } },
  });

  if (!budgetsRaw.length) {
    return NextResponse.json({ budgets: [] });
  }

  const budgetIds = budgetsRaw.map((budget) => budget.id);
  const aggregates = await prisma.financeEntry.groupBy({
    by: ["budgetId", "type"],
    where: {
      budgetId: { in: budgetIds },
      status: { in: ["approved", "paid"] },
      visibilityScope: { in: allowedScopes },
      showId,
    },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const totals = new Map<string, { amount: number; count: number }>();
  for (const aggregate of aggregates) {
    if (!aggregate.budgetId) continue;
    const current = totals.get(aggregate.budgetId) ?? { amount: 0, count: 0 };
    const sum = aggregate._sum.amount ?? 0;
    const signed = aggregate.type === "expense" ? sum : -sum;
    current.amount += signed;
    current.count += aggregate._count._all ?? 0;
    totals.set(aggregate.budgetId, current);
  }

  const budgets: FinanceBudgetWithMeta[] = budgetsRaw.map((budget) => {
    const info = totals.get(budget.id) ?? { amount: 0, count: 0 };
    return {
      ...budget,
      actualAmount: info.amount,
      entryCount: info.count,
    };
  });

  return NextResponse.json({ budgets: budgets.map(mapFinanceBudget) });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  const canManage = await hasPermission(session.user, "mitglieder.finanzen.manage");
  if (!canManage) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = budgetSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = parsed.data;
  const showExists = await prisma.show.count({ where: { id: payload.showId } });
  if (!showExists) {
    return NextResponse.json({ error: "Produktion nicht gefunden" }, { status: 400 });
  }
  const budget = await prisma.financeBudget.create({
    data: {
      category: payload.category.trim(),
      plannedAmount: payload.plannedAmount,
      currency: payload.currency.toUpperCase(),
      notes: payload.notes?.trim() ?? null,
      showId: payload.showId,
    },
    include: { show: { select: { id: true, title: true, year: true } } },
  });

  return NextResponse.json({ budget: mapFinanceBudget({ ...budget, actualAmount: 0, entryCount: 0 }) }, { status: 201 });
}
