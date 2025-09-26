import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { createEmptyFinanceSummary, resolveAllowedVisibilityScopes } from "../utils";
import type { FinanceEntryStatus } from "@prisma/client";

const STATUS_FOR_TOTALS: FinanceEntryStatus[] = ["pending", "approved", "paid"];
const STATUS_FOR_DONATIONS: FinanceEntryStatus[] = ["approved", "paid"];
const PENDING_STATUSES: FinanceEntryStatus[] = ["pending", "approved"];

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

  const [totals, pending, donations] = await Promise.all([
    prisma.financeEntry.groupBy({
      by: ["type"],
      where: { visibilityScope: { in: allowedScopes }, status: { in: STATUS_FOR_TOTALS }, showId },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        kind: "invoice",
        status: { in: PENDING_STATUSES },
        visibilityScope: { in: allowedScopes },
        showId,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        kind: "donation",
        status: { in: STATUS_FOR_DONATIONS },
        visibilityScope: { in: allowedScopes },
        showId,
      },
      _sum: { amount: true },
    }),
  ]);

  const summary = createEmptyFinanceSummary();

  for (const entry of totals) {
    const sum = entry._sum.amount ?? 0;
    if (entry.type === "income") {
      summary.totalIncome += sum;
    } else if (entry.type === "expense") {
      summary.totalExpense += sum;
    }
  }

  summary.pendingInvoices = pending._count._all ?? 0;
  summary.pendingAmount = pending._sum.amount ?? 0;
  summary.donationTotal = donations._sum.amount ?? 0;

  return NextResponse.json({ summary });
}
