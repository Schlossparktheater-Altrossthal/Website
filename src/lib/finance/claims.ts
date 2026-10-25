import type { ExpenseClaimPayout, ExpenseClaimStatus, Prisma } from "@prisma/client";

import {
  canSeeDepartmentFinance,
  getLeadDepartmentIds,
  type FinanceAccess,
} from "@/lib/finance/access";
import { FINANCE_LIMITS, FINANCE_PERMISSION_KEYS } from "@/lib/finance/constants";
import { FinanceError, createEntryInTx } from "@/lib/finance/ledger";
import { FINANCE_HOME_PATH, MY_CLAIMS_PATH } from "@/lib/finance/paths";
import { ensureGeneralPeriod, ensureShowPeriod, formatEntryNumber } from "@/lib/finance/periods";
import type { ReceiptUpload } from "@/lib/finance/receipts";
import { formatCents } from "@/lib/format/money";
import { getUserDisplayName } from "@/lib/names";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { findUserIdsWithPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** Auslagen (docs/Plan/finanzen-plan.md, Phase 2): einreichen → Gewerk prüft → Kassenwart erstattet. */

export type ClaimInput = {
  /** Produktion oder `null` für „Allgemein“ des laufenden Jahres. */
  showId: string | null;
  amountCents: number;
  spentOn: Date;
  purpose: string;
  vendor?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
  payout: ExpenseClaimPayout;
};

const userNameSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
} as const;

export const claimViewInclude = {
  submittedBy: { select: userNameSelect },
  departmentCheckedBy: { select: userNameSelect },
  reviewedBy: { select: userNameSelect },
  department: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true } },
  fund: { select: { id: true, name: true } },
  period: { select: { id: true, code: true, name: true } },
  entry: { select: { number: true } },
  receipts: { select: { id: true, filename: true, mimeType: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ExpenseClaimInclude;

type ClaimRow = Prisma.ExpenseClaimGetPayload<{ include: typeof claimViewInclude }>;

export type ClaimView = {
  id: string;
  amountCents: number;
  spentOn: string;
  purpose: string;
  vendor: string | null;
  payout: ExpenseClaimPayout;
  status: ExpenseClaimStatus;
  /** Wartet auf Gewerk, Kassenwart oder ist fertig. */
  stage: "department" | "treasurer" | "done";
  submittedBy: { id: string; name: string };
  department: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  fund: { id: string; name: string } | null;
  periodName: string;
  departmentCheckedBy: string | null;
  reviewedBy: string | null;
  rejectReason: string | null;
  paidAt: string | null;
  entryNumber: string | null;
  receipts: { id: string; filename: string; mimeType: string }[];
  createdAt: string;
};

export function claimStage(
  claim: Pick<ClaimRow, "status" | "departmentId" | "departmentCheckedAt">,
): ClaimView["stage"] {
  if (claim.status === "paid" || claim.status === "rejected") return "done";
  if (claim.status === "submitted" && claim.departmentId && !claim.departmentCheckedAt)
    return "department";
  return "treasurer";
}

export function toClaimView(row: ClaimRow): ClaimView {
  return {
    id: row.id,
    amountCents: row.amountCents,
    spentOn: row.spentOn.toISOString().slice(0, 10),
    purpose: row.purpose,
    vendor: row.vendor,
    payout: row.payout,
    status: row.status,
    stage: claimStage(row),
    submittedBy: { id: row.submittedBy.id, name: getUserDisplayName(row.submittedBy) },
    department: row.department ? { id: row.department.id, name: row.department.name } : null,
    category: row.category,
    fund: row.fund,
    periodName: row.period.name,
    departmentCheckedBy: row.departmentCheckedBy
      ? getUserDisplayName(row.departmentCheckedBy)
      : null,
    reviewedBy: row.reviewedBy ? getUserDisplayName(row.reviewedBy) : null,
    rejectReason: row.rejectReason,
    paidAt: row.paidAt?.toISOString() ?? null,
    entryNumber: row.entry ? formatEntryNumber(row.period.code, row.entry.number) : null,
    receipts: row.receipts,
    createdAt: row.createdAt.toISOString(),
  };
}

export function validateClaimInput(input: ClaimInput): void {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new FinanceError("Bitte einen Betrag angeben.");
  }
  if (input.amountCents > FINANCE_LIMITS.maxAmountCents)
    throw new FinanceError("Betrag ist unplausibel hoch.");
  const purpose = input.purpose.trim();
  if (!purpose) throw new FinanceError("Wofür war die Auslage?");
  if (purpose.length > FINANCE_LIMITS.description)
    throw new FinanceError("Beschreibung ist zu lang.");
  if ((input.vendor?.length ?? 0) > FINANCE_LIMITS.counterparty)
    throw new FinanceError("Händler ist zu lang.");
  const tomorrow = Date.now() + 86_400_000;
  if (Number.isNaN(input.spentOn.getTime()) || input.spentOn.getTime() > tomorrow) {
    throw new FinanceError("Datum liegt in der Zukunft.");
  }
}

async function departmentLeadIds(departmentId: string) {
  const rows = await prisma.departmentMembership.findMany({
    where: { departmentId, status: "active", role: { in: ["lead", "deputy"] } },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

const treasurerIds = () => findUserIdsWithPermission(FINANCE_PERMISSION_KEYS.manage);

export async function submitClaim(userId: string, input: ClaimInput, receipts: ReceiptUpload[]) {
  validateClaimInput(input);
  if (!receipts.length) throw new FinanceError("Bitte ein Foto oder PDF vom Beleg anhängen.");
  const period = input.showId
    ? await ensureShowPeriod(input.showId)
    : await ensureGeneralPeriod(new Date().getFullYear());
  if (period.closedAt) throw new FinanceError("Der Zeitraum ist abgeschlossen.");
  if (input.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { showId: true },
    });
    if (!department || department.showId !== input.showId)
      throw new FinanceError("Gewerk passt nicht zur Produktion.");
  }
  const claim = await prisma.expenseClaim.create({
    data: {
      periodId: period.id,
      submittedById: userId,
      amountCents: input.amountCents,
      spentOn: input.spentOn,
      purpose: input.purpose.trim(),
      vendor: input.vendor?.trim() || null,
      departmentId: input.departmentId ?? null,
      categoryId: input.categoryId ?? null,
      payout: input.payout,
      receipts: {
        create: receipts.map((receipt) => ({
          data: receipt.data,
          mimeType: receipt.mimeType,
          filename: receipt.filename,
          size: receipt.size,
          uploadedById: userId,
        })),
      },
      logs: { create: { actorId: userId, action: "submitted" } },
    },
    include: { submittedBy: { select: userNameSelect }, department: { select: { name: true } } },
  });

  const leads = input.departmentId
    ? (await departmentLeadIds(input.departmentId)).filter((id) => id !== userId)
    : [];
  const toDepartment = leads.length > 0;
  if (!toDepartment && input.departmentId) {
    // Leitung reicht selbst ein oder es gibt keine: Gewerksprüfung entfällt.
    await prisma.expenseClaim.update({
      where: { id: claim.id },
      data: { departmentCheckedAt: new Date(), departmentCheckedById: userId },
    });
  }
  await notify({
    type: NOTIFICATION_TYPES.EXPENSE_CLAIM,
    recipients: toDepartment ? leads : await treasurerIds(),
    category: "verwaltung",
    actorId: userId,
    title: `Auslage ${formatCents(claim.amountCents)}: ${claim.purpose}`,
    body: `${getUserDisplayName(claim.submittedBy)}${claim.department ? ` · ${claim.department.name}` : ""} – bitte prüfen.`,
    actionUrl: toDepartment ? MY_CLAIMS_PATH : FINANCE_HOME_PATH,
    groupKey: `expense-claim:${claim.id}`,
  }).catch((error) => console.warn("[finanzen] Benachrichtigung fehlgeschlagen", error));
  return claim;
}

async function loadClaim(id: string) {
  const claim = await prisma.expenseClaim.findUnique({ where: { id }, include: claimViewInclude });
  if (!claim) throw new FinanceError("Auslage nicht gefunden.");
  return claim;
}

/** Eigene, noch ungeprüfte Auslage zurückziehen. */
export async function withdrawClaim(userId: string, id: string) {
  const claim = await loadClaim(id);
  if (claim.submittedById !== userId) throw new FinanceError("Nicht deine Auslage.");
  if (claim.status !== "submitted" || claim.reviewedAt)
    throw new FinanceError("Die Auslage ist schon in Bearbeitung.");
  await prisma.expenseClaim.delete({ where: { id } });
}

/** Gewerksleitung bestätigt: sachlich richtig. */
export async function departmentCheckClaim(access: FinanceAccess, actorId: string, id: string) {
  const claim = await loadClaim(id);
  if (!claim.departmentId || !access.leadDepartmentIds.includes(claim.departmentId)) {
    throw new FinanceError("Nur die Gewerksleitung kann das bestätigen.");
  }
  if (claim.status !== "submitted" || claim.departmentCheckedAt) return;
  await prisma.expenseClaim.update({
    where: { id },
    data: {
      departmentCheckedAt: new Date(),
      departmentCheckedById: actorId,
      logs: { create: { actorId, action: "department_checked" } },
    },
  });
  await notify({
    type: NOTIFICATION_TYPES.EXPENSE_CLAIM,
    recipients: await treasurerIds(),
    category: "verwaltung",
    actorId,
    title: `Auslage ${formatCents(claim.amountCents)}: ${claim.purpose}`,
    body: `${getUserDisplayName(claim.submittedBy)} · vom Gewerk ${claim.department?.name ?? ""} bestätigt.`,
    actionUrl: FINANCE_HOME_PATH,
    groupKey: `expense-claim:${claim.id}`,
  }).catch((error) => console.warn("[finanzen] Benachrichtigung fehlgeschlagen", error));
}

export async function rejectClaim(
  access: FinanceAccess,
  actorId: string,
  id: string,
  reason: string,
) {
  const claim = await loadClaim(id);
  const allowed =
    access.manage ||
    (claim.departmentId !== null && access.leadDepartmentIds.includes(claim.departmentId));
  if (!allowed) throw new FinanceError("Nicht berechtigt.");
  if (claim.status === "paid" || claim.status === "rejected")
    throw new FinanceError("Auslage ist schon abgeschlossen.");
  const text = reason.trim();
  if (!text) throw new FinanceError("Bitte einen Grund angeben.");
  await prisma.expenseClaim.update({
    where: { id },
    data: {
      status: "rejected",
      rejectReason: text.slice(0, FINANCE_LIMITS.description),
      reviewedAt: new Date(),
      reviewedById: actorId,
      logs: { create: { actorId, action: "rejected", data: { reason: text } } },
    },
  });
  await notifySubmitter(claim, actorId, "abgelehnt", text);
}

/** Kassenwart gibt frei (Erstattung folgt später, z. B. gesammelt per Überweisung). */
export async function approveClaim(actorId: string, id: string, fundId: string) {
  const claim = await loadClaim(id);
  if (claim.status !== "submitted") throw new FinanceError("Auslage ist nicht mehr offen.");
  await prisma.expenseClaim.update({
    where: { id },
    data: {
      status: "approved",
      fundId,
      reviewedAt: new Date(),
      reviewedById: actorId,
      logs: { create: { actorId, action: "approved", data: { fundId } } },
    },
  });
}

/**
 * Erstatten und buchen: Ausgabe im Kassenbuch, bei „Spenden“ zusätzlich die Spende als Einnahme
 * (Verzicht auf Erstattung). Freigabe wird dabei mit erledigt.
 */
export async function payClaim(
  actorId: string,
  id: string,
  fundId: string,
  bookingDate = new Date(),
) {
  const claim = await loadClaim(id);
  if (claim.status !== "submitted" && claim.status !== "approved") {
    throw new FinanceError("Auslage ist schon abgeschlossen.");
  }
  const submitter = getUserDisplayName(claim.submittedBy);
  await prisma.$transaction(async (tx) => {
    const entry = await createEntryInTx(
      tx,
      {
        periodId: claim.periodId,
        fundId,
        type: "expense",
        amountCents: claim.amountCents,
        bookingDate,
        description: `Auslage ${submitter} – ${claim.purpose}`.slice(0, FINANCE_LIMITS.description),
        counterparty: claim.vendor,
        categoryId: claim.categoryId,
        departmentId: claim.departmentId,
        source: "expense_claim",
      },
      actorId,
    );
    await tx.financeReceipt.updateMany({
      where: { claimId: claim.id },
      data: { entryId: entry.id },
    });
    if (claim.payout === "donated") {
      const donations = await tx.financeCategory.findFirst({
        where: { type: "income", name: "Spenden", archivedAt: null },
        select: { id: true },
      });
      await createEntryInTx(
        tx,
        {
          periodId: claim.periodId,
          fundId,
          type: "income",
          amountCents: claim.amountCents,
          bookingDate,
          description: `Spende ${submitter} (Verzicht auf Erstattung)`.slice(
            0,
            FINANCE_LIMITS.description,
          ),
          counterparty: submitter,
          categoryId: donations?.id ?? null,
          departmentId: claim.departmentId,
          source: "donation",
          donorName: submitter,
        },
        actorId,
      );
    }
    await tx.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status: "paid",
        fundId,
        entryId: entry.id,
        paidAt: new Date(),
        reviewedAt: claim.reviewedAt ?? new Date(),
        reviewedById: claim.reviewedById ?? actorId,
        logs: { create: { actorId, action: "paid", data: { fundId, entryId: entry.id } } },
      },
    });
  });
  await notifySubmitter(
    claim,
    actorId,
    claim.payout === "donated" ? "als Spende verbucht" : "erstattet",
  );
}

async function notifySubmitter(claim: ClaimRow, actorId: string, verb: string, reason?: string) {
  await notify({
    type: NOTIFICATION_TYPES.EXPENSE_CLAIM,
    recipients: [claim.submittedById],
    actorId,
    title: `Auslage ${verb}: ${claim.purpose}`,
    body: reason
      ? `${formatCents(claim.amountCents)} · Grund: ${reason}`
      : formatCents(claim.amountCents),
    actionUrl: MY_CLAIMS_PATH,
    groupKey: `expense-claim:${claim.id}`,
    severity: verb === "abgelehnt" ? "warning" : "success",
  }).catch((error) => console.warn("[finanzen] Benachrichtigung fehlgeschlagen", error));
}

// ── Abfragen ────────────────────────────────────────────────────────────────

export async function listMyClaims(userId: string) {
  const rows = await prisma.expenseClaim.findMany({
    where: { submittedById: userId },
    include: claimViewInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(toClaimView);
}

/** Offene Auslagen der Gewerke, die die Person leitet. */
export async function listDepartmentClaims(userId: string) {
  const departmentIds = await getLeadDepartmentIds(userId);
  if (!departmentIds.length) return [];
  const rows = await prisma.expenseClaim.findMany({
    where: { departmentId: { in: departmentIds }, status: "submitted", departmentCheckedAt: null },
    include: claimViewInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toClaimView);
}

/** Eingang des Kassenwarts: alles Offene, Gewerk-Bestätigtes zuerst. */
export async function listInboxClaims() {
  const rows = await prisma.expenseClaim.findMany({
    where: { status: { in: ["submitted", "approved"] } },
    include: claimViewInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows
    .map(toClaimView)
    .sort((a, b) => Number(a.stage === "department") - Number(b.stage === "department"));
}

/** Darf die Person diesen Beleg sehen? Einreicher, Kassenwart/Prüfer, Gewerksleitung. */
export async function canViewReceipt(access: FinanceAccess, userId: string, receiptId: string) {
  const receipt = await prisma.financeReceipt.findUnique({
    where: { id: receiptId },
    select: {
      claim: { select: { submittedById: true, departmentId: true } },
      entry: { select: { departmentId: true } },
    },
  });
  if (!receipt) return false;
  if (access.viewAll) return true;
  if (receipt.claim?.submittedById === userId) return true;
  const departmentId = receipt.claim?.departmentId ?? receipt.entry?.departmentId;
  return Boolean(departmentId && canSeeDepartmentFinance(access, departmentId));
}
