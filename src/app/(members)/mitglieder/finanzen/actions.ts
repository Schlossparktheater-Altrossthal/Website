"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import { getFinanceAccess } from "@/lib/finance/access";
import {
  approveClaim,
  departmentCheckClaim,
  payClaim,
  rejectClaim,
  submitClaim,
  withdrawClaim,
} from "@/lib/finance/claims";
import { FinanceError } from "@/lib/finance/ledger";
import { FINANCE_HOME_PATH, MY_CLAIMS_PATH } from "@/lib/finance/paths";
import { readReceiptFiles } from "@/lib/finance/receipts";
import { parseEuroToCents } from "@/lib/format/money";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

function revalidate() {
  revalidatePath(FINANCE_HOME_PATH, "layout");
  revalidatePath("/mitglieder");
}

async function session() {
  const current = await requireAuth();
  const userId = current.user?.id;
  if (!userId) throw new FinanceError("Nicht angemeldet.");
  return { user: current.user, userId, access: await getFinanceAccess(current.user) };
}

async function run(task: () => Promise<void>): Promise<ActionResult> {
  try {
    await task();
    revalidate();
    return actionOk();
  } catch (error) {
    if (error instanceof FinanceError || error instanceof z.ZodError) {
      return actionError(
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Ungültige Eingaben.")
          : error.message,
      );
    }
    if (error instanceof Error && /Beleg|Foto|groß|PDF/.test(error.message))
      return actionError(error.message);
    console.error("[finanzen] Aktion fehlgeschlagen", error);
    return actionError("Das hat nicht geklappt. Bitte noch einmal versuchen.");
  }
}

const id = z.string().min(1).max(40);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.");
const optionalId = z
  .string()
  .max(40)
  .optional()
  .transform((value) => value || null);

const claimSchema = z.object({
  showId: optionalId,
  amount: z.string().max(20),
  spentOn: day,
  purpose: z.string().max(400),
  vendor: z.string().max(400).optional(),
  departmentId: optionalId,
  categoryId: optionalId,
  payout: z.enum(["cash", "bank", "paypal", "donated"]),
});

export async function submitClaimAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const { userId } = await session();
    const input = claimSchema.parse(
      Object.fromEntries(Array.from(formData.entries()).filter(([, v]) => typeof v === "string")),
    );
    const amountCents = parseEuroToCents(input.amount);
    if (!amountCents) throw new FinanceError("Bitte einen gültigen Betrag angeben, z. B. 23,80.");
    if (input.categoryId) {
      const category = await prisma.financeCategory.findUnique({ where: { id: input.categoryId } });
      if (category?.type !== "expense") throw new FinanceError("Unbekannte Kategorie.");
    }
    await submitClaim(
      userId,
      {
        showId: input.showId,
        amountCents,
        spentOn: new Date(`${input.spentOn}T00:00:00.000Z`),
        purpose: input.purpose,
        vendor: input.vendor,
        departmentId: input.departmentId,
        categoryId: input.categoryId,
        payout: input.payout,
      },
      await readReceiptFiles(formData),
    );
  });
}

export async function withdrawClaimAction(input: { id: string }): Promise<ActionResult> {
  return run(async () => {
    const { userId } = await session();
    await withdrawClaim(userId, id.parse(input.id));
  });
}

export async function departmentCheckClaimAction(input: { id: string }): Promise<ActionResult> {
  return run(async () => {
    const { userId, access } = await session();
    await departmentCheckClaim(access, userId, id.parse(input.id));
  });
}

export async function rejectClaimAction(input: {
  id: string;
  reason: string;
}): Promise<ActionResult> {
  return run(async () => {
    const { userId, access } = await session();
    await rejectClaim(access, userId, id.parse(input.id), z.string().max(400).parse(input.reason));
  });
}

async function requireManage() {
  const current = await session();
  if (!current.access.manage) throw new FinanceError("Nur der Kassenwart kann das.");
  return current;
}

async function activeFund(fundId: string) {
  const fund = await prisma.financeFund.findUnique({ where: { id: id.parse(fundId) } });
  if (!fund || fund.archivedAt) throw new FinanceError("Bitte einen Geldtopf wählen.");
  return fund.id;
}

export async function approveClaimAction(input: {
  id: string;
  fundId: string;
}): Promise<ActionResult> {
  return run(async () => {
    const { userId } = await requireManage();
    await approveClaim(userId, id.parse(input.id), await activeFund(input.fundId));
  });
}

export async function payClaimAction(input: {
  id: string;
  fundId: string;
  bookingDate?: string;
}): Promise<ActionResult> {
  return run(async () => {
    const { userId } = await requireManage();
    const bookingDate = input.bookingDate
      ? new Date(`${day.parse(input.bookingDate)}T00:00:00.000Z`)
      : undefined;
    await payClaim(userId, id.parse(input.id), await activeFund(input.fundId), bookingDate);
  });
}

// ── Geldtöpfe (Kassenwart) ─────────────────────────────────────────────────

const fundSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Name fehlt.").max(80),
  kind: z.enum(["bank", "cash", "other"]),
  description: z.string().max(400).optional(),
  archived: z.boolean().optional(),
});

export async function saveFundAction(input: z.input<typeof fundSchema>): Promise<ActionResult> {
  return run(async () => {
    await requireManage();
    const data = fundSchema.parse(input);
    const values = {
      name: data.name,
      kind: data.kind,
      description: data.description?.trim() || null,
      archivedAt: data.archived ? new Date() : null,
    };
    const duplicate = await prisma.financeFund.findFirst({
      where: { name: data.name, ...(data.id ? { NOT: { id: data.id } } : {}) },
    });
    if (duplicate) throw new FinanceError("Einen Topf mit diesem Namen gibt es schon.");
    if (data.id) {
      await prisma.financeFund.update({ where: { id: data.id }, data: values });
    } else {
      const count = await prisma.financeFund.count();
      await prisma.financeFund.create({ data: { ...values, sortOrder: count } });
    }
  });
}
