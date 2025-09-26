import type { FinanceEntryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeQueryParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first.trim().length ? first.trim() : null;
  }
  return null;
}

export default async function FinancePage({ params, searchParams }: PageProps) {
  const session = await requireAuth();
  const resolvedParams = await params;
  const resolvedSearch = (await searchParams) ?? {};
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

  const shows = await prisma.show.findMany({
    orderBy: { year: "desc" },
    select: { id: true, title: true, year: true },
  });

  const showOptions = shows.map((show) => ({ id: show.id, title: show.title, year: show.year }));
  const requestedShowId = normalizeQueryParam(resolvedSearch.showId);
  const activeProductionId = await getActiveProductionId(session.user?.id);

  const preferredShowIds = [requestedShowId, activeProductionId].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  let selectedShowId: string | null = null;
  for (const candidate of preferredShowIds) {
    if (showOptions.some((show) => show.id === candidate)) {
      selectedShowId = candidate;
      break;
    }
  }

  if (!selectedShowId) {
    selectedShowId = showOptions[0]?.id ?? null;
  }

  if (!selectedShowId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Finanzen" description="Es ist noch keine Produktion verfügbar." />
        <div className="rounded-lg border border-muted-foreground/30 bg-muted/10 p-6 text-sm text-muted-foreground">
          Bitte lege zunächst eine Produktion an, um Finanzdaten zu erfassen.
        </div>
      </div>
    );
  }

  const entriesPromise = prisma.financeEntry.findMany({
    where: {
      visibilityScope: { in: allowedScopes },
      status: { in: DEFAULT_STATUS_FILTER },
      showId: selectedShowId,
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
    where: { showId: selectedShowId },
    orderBy: { category: "asc" },
    include: { show: { select: { id: true, title: true, year: true } } },
  });

  const summaryPromise = (async () => {
    const [totals, pending, donations] = await Promise.all([
      prisma.financeEntry.groupBy({
        by: ["type"],
        where: {
          visibilityScope: { in: allowedScopes },
          status: { in: ["pending", "approved", "paid"] },
          showId: selectedShowId,
        },
        _sum: { amount: true },
      }),
      prisma.financeEntry.aggregate({
        where: {
          kind: "invoice",
          status: { in: ["pending", "approved"] },
          visibilityScope: { in: allowedScopes },
          showId: selectedShowId,
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.financeEntry.aggregate({
        where: {
          kind: "donation",
          status: { in: ["approved", "paid"] },
          visibilityScope: { in: allowedScopes },
          showId: selectedShowId,
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

  const [entriesRaw, budgetsRaw, summary, members] = await Promise.all([
    entriesPromise,
    budgetsPromise,
    summaryPromise,
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
          showId: selectedShowId,
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

  const memberOptions = members.map((member) => ({ id: member.id, name: member.name, email: member.email }));
  const activeShow = showOptions.find((show) => show.id === selectedShowId) ?? null;

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
      selectedShowId={selectedShowId}
      activeShow={activeShow}
    />
  );
}
