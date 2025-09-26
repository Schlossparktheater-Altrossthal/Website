import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { mapFinanceBudget } from "../../utils";

const updateSchema = z
  .object({
    category: z.string().min(2).max(120).optional(),
    plannedAmount: z.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    notes: z.string().max(400).optional().nullable(),
    showId: z.string().optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireAuth();
  const canManage = await hasPermission(session.user, "mitglieder.finanzen.manage");
  if (!canManage) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = parsed.data;
  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: "Keine Änderungen übermittelt" }, { status: 400 });
  }

  const data: Prisma.FinanceBudgetUpdateInput = {};

  if (payload.category !== undefined) {
    data.category = payload.category.trim();
  }
  if (payload.plannedAmount !== undefined) {
    data.plannedAmount = payload.plannedAmount;
  }
  if (payload.currency !== undefined) {
    data.currency = payload.currency.toUpperCase();
  }
  if (payload.notes !== undefined) {
    data.notes = payload.notes?.trim() ?? null;
  }
  if (payload.showId !== undefined) {
    const showExists = await prisma.show.count({ where: { id: payload.showId } });
    if (!showExists) {
      return NextResponse.json({ error: "Produktion nicht gefunden" }, { status: 400 });
    }
    data.show = { connect: { id: payload.showId } };
  }

  const updated = await prisma.financeBudget.update({
    where: { id },
    data,
    include: { show: { select: { id: true, title: true, year: true } } },
  });

  const aggregates = await prisma.financeEntry.aggregate({
    where: { budgetId: id, status: { in: ["approved", "paid"] } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const actualAmount = aggregates._sum.amount ?? 0;
  const entryCount = aggregates._count._all ?? 0;

  return NextResponse.json({ budget: mapFinanceBudget({ ...updated, actualAmount, entryCount }) });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireAuth();
  const canManage = await hasPermission(session.user, "mitglieder.finanzen.manage");
  if (!canManage) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const usage = await prisma.financeEntry.count({ where: { budgetId: id } });
  if (usage > 0) {
    return NextResponse.json({ error: "Budget enthält Buchungen und kann nicht gelöscht werden." }, { status: 400 });
  }

  await prisma.financeBudget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
