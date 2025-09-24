import type { FinanceEntryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { FinanceOverview } from "@/components/members/finance/finance-overview";
import {
  createEmptyFinanceSummary,
  mapFinanceBudget,
  mapFinanceEntry,
  resolveAllowedVisibilityScopes,
  type FinanceBudgetWithMeta,
  type FinanceEntryWithRelations,
} from "@/app/api/finance/utils";
import { PageHeader } from "@/components/members/page-header";

export const dynamic = "force-dynamic";

const DEFAULT_STATUS_FILTER: FinanceEntryStatus[] = ["draft", "pending", "approved", "paid"];
const VALID_SECTIONS = new Set(["dashboard", "buchungen", "budgets", "export"]);

interface PageProps {
  params: Promise<{ section?: string[] }>;
}

export default async function FinancePage({ params }: PageProps) {
  const session = await requireAuth();
  const resolvedParams = await params;
  const [canView, canManage, canApprove, canExport] = await Promise.all([
    hasPermission(session.user, "mitglieder.finanzen"),
    hasPermission(session.user, "mitglieder.finanzen.manage"),
    hasPermission(session.user, "mitglieder.finanzen.approve"),
    hasPermission(session.user, "mitglieder.finanzen.export"),
  ]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Finanzen" description="Du hast keine Berechtigung für diesen Bereich." />
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Für den Finanzbereich benötigst du eine entsprechende Rolle.
        </div>
      </div>
    );
  }

  const allowedScopes = resolveAllowedVisibilityScopes(session.user, canApprove);
  const requestedSection = resolvedParams?.section?.[0] ?? "dashboard";
  const activeSection = VALID_SECTIONS.has(requestedSection)
    ? (requestedSection as "dashboard" | "buchungen" | "budgets" | "export")
    : "dashboard";

  const entriesPromise = prisma.financeEntry.findMany({
    where: {
      visibilityScope: { in: allowedScopes },
      status: { in: DEFAULT_STATUS_FILTER },
    },
    orderBy: { bookingDate: "desc" },
    take: 200,
    include: {
      show: { select: { id: true, title: true, year: true } },
      budget: { include: { show: { select: { id: true, title: true, year: true } } } },
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      memberPaidBy: { select: { id: true, name: true, email: true } },
      attachments: true,
      logs: {
        include: { changedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const budgetsPromise = prisma.financeBudget.findMany({
    orderBy: [{ show: { year: "desc" } }, { category: "asc" }],
    include: { show: { select: { id: true, title: true, year: true } } },
  });

  const summaryPromise = (async () => {
    const [totals, pending, donations] = await Promise.all([
      prisma.financeEntry.groupBy({
        by: ["type"],
        where: { visibilityScope: { in: allowedScopes }, status: { in: ["pending", "approved", "paid"] } },
        _sum: { amount: true },
      }),
      prisma.financeEntry.aggregate({
        where: {
          kind: "invoice",
          status: { in: ["pending", "approved"] },
          visibilityScope: { in: allowedScopes },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.financeEntry.aggregate({
        where: {
          kind: "donation",
          status: { in: ["approved", "paid"] },
          visibilityScope: { in: allowedScopes },
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
    return summary;
  })();

  const [entriesRaw, budgetsRaw, summary, shows, members] = await Promise.all([
    entriesPromise,
    budgetsPromise,
    summaryPromise,
    prisma.show.findMany({
      orderBy: { year: "desc" },
      select: { id: true, title: true, year: true },
    }),
    prisma.user.findMany({
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  const budgetIds = budgetsRaw.map((budget) => budget.id);
  const budgetAggregates = budgetIds.length
    ? await prisma.financeEntry.groupBy({
        by: ["budgetId", "type"],
        where: {
          budgetId: { in: budgetIds },
          status: { in: ["approved", "paid"] },
          visibilityScope: { in: allowedScopes },
        },
        _sum: { amount: true },
        _count: { _all: true },
      })
    : [];

  const totals = new Map<string, { amount: number; count: number }>();
  for (const aggregate of budgetAggregates) {
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

  const entries = entriesRaw.map((entry) => mapFinanceEntry(entry as FinanceEntryWithRelations));
  const budgetDtos = budgets.map((budget) => mapFinanceBudget(budget));

  const showOptions = shows.map((show) => ({ id: show.id, title: show.title, year: show.year }));
  const memberOptions = members.map((member) => ({ id: member.id, name: member.name, email: member.email }));

  return (
    <FinanceOverview
      initialEntries={entries}
      initialSummary={summary}
      initialBudgets={budgetDtos}
      showOptions={showOptions}
      memberOptions={memberOptions}
      canManage={canManage}
      canApprove={canApprove}
      canExport={canExport}
      allowedScopes={allowedScopes}
      activeSection={activeSection}
    />
  );
}
