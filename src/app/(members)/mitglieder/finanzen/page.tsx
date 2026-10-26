import { redirect } from "next/navigation";

import { ClaimInbox, type PayoutDetails } from "@/components/finance/claim-inbox";
import { BudgetManager } from "@/components/finance/budget-manager";
import { CashBook } from "@/components/finance/cash-book";
import { FinanceReports } from "@/components/finance/finance-reports";
import { FundManager } from "@/components/finance/fund-manager";
import { IncomeOverview } from "@/components/finance/income-overview";
import { loadBook, loadPeriodOptions, summarize } from "@/lib/finance/book";
import { loadBudgets } from "@/lib/finance/budgets";
import { loadPerformanceIncome } from "@/lib/finance/income";
import { loadFinanceReport } from "@/lib/finance/report";
import type { ClaimView } from "@/lib/finance/claims";
import { PageHeader } from "@/components/members/page-header";
import { SectionNav } from "@/components/ui/section-nav";
import { getFinanceAccess } from "@/lib/finance/access";
import { listInboxClaims } from "@/lib/finance/claims";
import { fundBalances } from "@/lib/finance/ledger";
import { FINANCE_HOME_PATH, MY_CLAIMS_PATH } from "@/lib/finance/paths";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export const metadata = { title: "Finanzen" };

const AREAS = [
  { id: "eingang", label: "Eingang" },
  { id: "kassenbuch", label: "Kassenbuch" },
  { id: "einnahmen", label: "Einnahmen" },
  { id: "budgets", label: "Budgets" },
  { id: "berichte", label: "Berichte" },
  { id: "toepfe", label: "Töpfe" },
] as const;

const ENTRY_TYPES = ["income", "expense", "transfer"] as const;
type SearchParams = {
  tab?: string;
  zeitraum?: string;
  topf?: string;
  art?: string;
  kategorie?: string;
  gewerk?: string;
  q?: string;
};
type Area = (typeof AREAS)[number]["id"];

/** Kassenwart: Auslagen-Eingang, Kassenbuch, Einnahmen je Vorstellung, Budgets, Geldtöpfe (docs/Plan/finanzen-plan.md). */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAuth();
  const access = await getFinanceAccess(session.user);
  if (!access.viewAll) redirect(MY_CLAIMS_PATH);
  const params = await searchParams;
  const tab = params.tab;
  const area: Area = AREAS.some((entry) => entry.id === tab) ? (tab as Area) : "eingang";

  const [claims, funds, entries] = await Promise.all([
    listInboxClaims(),
    prisma.financeFund.findMany({
      orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    area === "toepfe"
      ? prisma.financeEntry.findMany({
          select: { type: true, amountCents: true, fundId: true, transferFundId: true },
        })
      : [],
  ]);

  let payoutDetails: Record<string, PayoutDetails> = {};
  if (access.manage && claims.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(claims.map((claim) => claim.submittedBy.id))] } },
      select: { id: true, payoutIban: true, payoutAccountHolder: true, payoutPaypalHandle: true },
    });
    payoutDetails = Object.fromEntries(
      users.map((user) => [
        user.id,
        {
          iban: user.payoutIban,
          accountHolder: user.payoutAccountHolder,
          paypal: user.payoutPaypalHandle,
        },
      ]),
    );
  }
  const balances = fundBalances(entries);
  const book = area === "kassenbuch" ? await loadCashBook(session.user!.id!, params, claims) : null;
  const budgetData = area === "budgets" ? await loadBudgetTab(session.user!.id!, params) : null;
  const incomeData = area === "einnahmen" ? await loadIncomeTab(session.user!.id!, params) : null;
  const reportData =
    area === "berichte" ? await loadReportTab(session.user!.id!, params, funds) : null;
  const activeFunds = funds
    .filter((fund) => !fund.archivedAt)
    .map((fund) => ({ id: fund.id, name: fund.name }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finanzen"
        description="Auslagen prüfen und erstatten, Kassenbuch je Produktion führen, Geldtöpfe verwalten."
      />
      <SectionNav
        variant="underline"
        ariaLabel="Bereiche der Finanzen"
        activeId={area}
        items={AREAS.map((entry) => ({
          id: entry.id,
          label:
            entry.id === "eingang" && claims.length
              ? `${entry.label} (${claims.length})`
              : entry.label,
          href: entry.id === "eingang" ? FINANCE_HOME_PATH : `${FINANCE_HOME_PATH}?tab=${entry.id}`,
        }))}
      />
      {area === "eingang" ? (
        <ClaimInbox
          claims={claims}
          funds={activeFunds}
          payoutDetails={payoutDetails}
          canManage={access.manage}
        />
      ) : book ? (
        <CashBook {...book} funds={activeFunds} canManage={access.manage} />
      ) : reportData ? (
        <FinanceReports {...reportData} funds={activeFunds} />
      ) : incomeData ? (
        <IncomeOverview
          {...incomeData}
          funds={funds
            .filter((fund) => !fund.archivedAt)
            .map((fund) => ({ id: fund.id, name: fund.name, kind: fund.kind }))}
          canManage={access.manage}
        />
      ) : budgetData ? (
        <BudgetManager {...budgetData} funds={activeFunds} canManage={access.manage} />
      ) : (
        <FundManager
          canManage={access.manage}
          funds={funds.map((fund) => ({
            id: fund.id,
            name: fund.name,
            kind: fund.kind,
            description: fund.description,
            archived: Boolean(fund.archivedAt),
            balanceCents: balances.get(fund.id) ?? 0,
          }))}
        />
      )}
    </div>
  );
}

async function loadCashBook(userId: string, params: SearchParams, claims: ClaimView[]) {
  const { options, defaultId } = await loadPeriodOptions(userId);
  const periodId = options.some((option) => option.id === params.zeitraum)
    ? params.zeitraum!
    : defaultId;
  const type = (ENTRY_TYPES as readonly string[]).includes(params.art ?? "")
    ? (params.art as (typeof ENTRY_TYPES)[number])
    : null;
  const filter = {
    fundId: params.topf || null,
    type,
    categoryId: params.kategorie || null,
    departmentId: params.gewerk || null,
    query: params.q?.slice(0, 100) ?? "",
  };
  const { period, entries, totals } = await loadBook({ periodId, ...filter });
  const [categories, departments] = await Promise.all([
    prisma.financeCategory.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    period.showId
      ? prisma.department.findMany({
          where: { showId: period.showId, archivedAt: null },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : [],
  ]);
  return {
    periods: options,
    period: {
      id: period.id,
      name: period.name,
      code: period.code,
      lockedThrough: period.lockedThrough,
      nextNumber: period.nextNumber,
      closed: Boolean(period.closedAt),
    },
    entries,
    totals,
    openClaims: {
      count: claims.length,
      cents: claims.reduce((sum, claim) => sum + claim.amountCents, 0),
    },
    categories,
    departments,
    filter,
  };
}

async function loadBudgetTab(userId: string, params: SearchParams) {
  const { options, defaultId } = await loadPeriodOptions(userId);
  const periodId = options.some((option) => option.id === params.zeitraum)
    ? params.zeitraum!
    : defaultId;
  const period = await prisma.financePeriod.findUniqueOrThrow({ where: { id: periodId } });
  const [budgets, entries, departments, categories] = await Promise.all([
    loadBudgets(periodId),
    prisma.financeEntry.findMany({
      where: { periodId },
      select: {
        type: true,
        amountCents: true,
        fundId: true,
        transferFundId: true,
        reversalOfId: true,
      },
    }),
    period.showId
      ? prisma.department.findMany({
          where: { showId: period.showId, archivedAt: null },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : [],
    prisma.financeCategory.findMany({
      where: { type: "expense", archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return {
    periods: options,
    period: { id: period.id, name: period.name },
    budgets,
    expenseCents: summarize(entries, null).expenseCents,
    departments,
    categories,
  };
}

async function loadIncomeTab(userId: string, params: SearchParams) {
  const { options, defaultId } = await loadPeriodOptions(userId);
  const periodId = options.some((option) => option.id === params.zeitraum)
    ? params.zeitraum!
    : defaultId;
  const period = await prisma.financePeriod.findUniqueOrThrow({ where: { id: periodId } });
  return {
    periods: options,
    period: { id: period.id, name: period.name, hasShow: Boolean(period.showId) },
    performances: period.showId ? await loadPerformanceIncome(period.showId) : [],
  };
}

async function loadReportTab(userId: string, params: SearchParams, funds: { id: string }[]) {
  const { options, defaultId } = await loadPeriodOptions(userId);
  const periodId = options.some((option) => option.id === params.zeitraum)
    ? params.zeitraum!
    : defaultId;
  const fundId = funds.some((fund) => fund.id === params.topf) ? params.topf! : null;
  const report = await loadFinanceReport(periodId, fundId);
  return {
    periods: options,
    period: { id: report.period.id, name: report.period.name },
    fundId,
    totals: report.totals,
    byCategory: report.byCategory,
    byDepartment: report.byDepartment,
    donationCount: report.donations.length,
    entryCount: report.entries.length,
    receiptCount: report.entries.reduce((sum, entry) => sum + entry.receipts.length, 0),
  };
}
