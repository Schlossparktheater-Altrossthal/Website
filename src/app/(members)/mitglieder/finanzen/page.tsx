import { redirect } from "next/navigation";

import { ClaimInbox, type PayoutDetails } from "@/components/finance/claim-inbox";
import { FundManager } from "@/components/finance/fund-manager";
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
  { id: "toepfe", label: "Töpfe" },
] as const;
type Area = (typeof AREAS)[number]["id"];

/** Kassenwart: Auslagen-Eingang und Geldtöpfe; Kassenbuch, Budgets, Berichte folgen (docs/Plan/finanzen-plan.md). */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAuth();
  const access = await getFinanceAccess(session.user);
  if (!access.viewAll) redirect(MY_CLAIMS_PATH);
  const { tab } = await searchParams;
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
  const activeFunds = funds
    .filter((fund) => !fund.archivedAt)
    .map((fund) => ({ id: fund.id, name: fund.name }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finanzen"
        description="Auslagen prüfen und erstatten, Geldtöpfe verwalten. Kassenbuch, Budgets und Berichte kommen als Nächstes."
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
