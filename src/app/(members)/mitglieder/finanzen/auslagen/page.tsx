import type { PayoutMethod } from "@prisma/client";

import { MyClaims } from "@/components/finance/my-claims";
import { PageHeader } from "@/components/members/page-header";
import { getActiveProduction } from "@/lib/active-production";
import { listDepartmentClaims, listMyClaims } from "@/lib/finance/claims";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export const metadata = { title: "Meine Auslagen" };

const PAYOUT_DEFAULT: Record<PayoutMethod, "bank" | "paypal" | "cash"> = {
  BANK_TRANSFER: "bank",
  PAYPAL: "paypal",
  OTHER: "cash",
};

function maskIban(iban: string) {
  const compact = iban.replace(/\s+/g, "");
  return `${compact.slice(0, 4)} … ${compact.slice(-4)}`;
}

/** Auslagen einreichen und verfolgen; Gewerksleitungen prüfen hier (docs/Plan/finanzen-plan.md). */
export default async function MyClaimsPage() {
  const session = await requireAuth();
  const userId = session.user!.id!;
  const production = await getActiveProduction(userId);
  const [claims, reviewClaims, departments, memberships, categories, user] = await Promise.all([
    listMyClaims(userId),
    listDepartmentClaims(userId),
    production
      ? prisma.department.findMany({
          where: { showId: production.id, archivedAt: null },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : [],
    production
      ? prisma.departmentMembership.findMany({
          where: {
            userId,
            status: "active",
            department: { showId: production.id, archivedAt: null },
          },
          select: { departmentId: true, role: true },
        })
      : [],
    prisma.financeCategory.findMany({
      where: { type: "expense", archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { payoutMethod: true, payoutIban: true, payoutPaypalHandle: true },
    }),
  ]);

  const leadFirst = [...memberships].sort(
    (a, b) => Number(b.role === "lead") - Number(a.role === "lead"),
  );
  const payoutHint =
    user.payoutMethod === "PAYPAL" && user.payoutPaypalHandle
      ? `PayPal: ${user.payoutPaypalHandle}`
      : user.payoutIban
        ? `IBAN ${maskIban(user.payoutIban)}`
        : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meine Auslagen"
        description="Du hast etwas fürs Theater bezahlt? Hier reichst du den Beleg ein und siehst, wann erstattet wird."
      />
      <div className="max-w-2xl">
        <MyClaims
          currentUserId={userId}
          claims={claims}
          reviewClaims={reviewClaims}
          production={
            production
              ? { id: production.id, title: production.title ?? `Produktion ${production.year}` }
              : null
          }
          generalPeriodName={`Allgemein ${new Date().getFullYear()}`}
          departments={departments}
          defaultDepartmentId={leadFirst[0]?.departmentId ?? null}
          categories={categories}
          defaultPayout={PAYOUT_DEFAULT[user.payoutMethod]}
          payoutHint={payoutHint}
        />
      </div>
    </div>
  );
}
