import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma, VisibilityScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { mapFinanceEntry, resolveAllowedVisibilityScopes, type FinanceEntryWithRelations } from "../utils";

function parseDate(input: unknown): Date | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function ensureAllowedScope(requested: VisibilityScope | undefined, allowed: readonly VisibilityScope[]): VisibilityScope {
  if (requested && allowed.includes(requested)) {
    return requested;
  }
  return allowed[0] ?? "finance";
}

async function loadEntry(id: string) {
  return prisma.financeEntry.findUnique({
    where: { id },
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
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireAuth();
  const [canView, canApprove] = await Promise.all([
    hasPermission(session.user, "mitglieder.finanzen"),
    hasPermission(session.user, "mitglieder.finanzen.approve"),
  ]);

  if (!canView) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const entry = await loadEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  const allowedScopes = resolveAllowedVisibilityScopes(session.user, canApprove);
  if (!allowedScopes.includes(entry.visibilityScope)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  return NextResponse.json({ entry: mapFinanceEntry(entry as FinanceEntryWithRelations) });
}

const attachmentSchema = z.object({
  filename: z.string().min(1).max(160),
  url: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length ? value : null))
    .refine((value) => !value || /^https?:\/\//.test(value), {
      message: "Anhänge benötigen eine gültige URL",
    }),
  mimeType: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length ? value : null)),
  size: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
});

const updateSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(4000).optional().nullable(),
    amount: z.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    type: z.enum(["income", "expense"] as const).optional(),
    kind: z.enum(["general", "invoice", "donation"] as const).optional(),
    status: z.enum(["draft", "pending", "approved", "paid", "cancelled"] as const).optional(),
    category: z.string().max(120).optional().nullable(),
    bookingDate: z.string().optional(),
    dueDate: z.string().optional().nullable(),
    paidAt: z.string().optional().nullable(),
    invoiceNumber: z.string().max(120).optional().nullable(),
    vendor: z.string().max(160).optional().nullable(),
    memberPaidById: z.string().optional().nullable(),
    donationSource: z.string().max(160).optional().nullable(),
    donorContact: z.string().max(200).optional().nullable(),
    tags: z.any().optional(),
    showId: z.string().optional().nullable(),
    budgetId: z.string().optional().nullable(),
    visibilityScope: z.enum(["finance", "board"] as const).optional(),
    attachments: z.array(attachmentSchema).optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireAuth();
  const [canManage, canApprove] = await Promise.all([
    hasPermission(session.user, "mitglieder.finanzen.manage"),
    hasPermission(session.user, "mitglieder.finanzen.approve"),
  ]);

  if (!canManage) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Nutzer unbekannt" }, { status: 400 });
  }

  const entry = await loadEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  const allowedScopes = resolveAllowedVisibilityScopes(session.user, canApprove);
  if (!allowedScopes.includes(entry.visibilityScope)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = parsed.data;
  const data: Prisma.FinanceEntryUpdateInput = {};
  let newStatusLog: Prisma.FinanceLogCreateWithoutEntryInput | null = null;

  if (payload.title !== undefined) {
    data.title = payload.title.trim();
  }
  if (payload.description !== undefined) {
    data.description = payload.description?.trim() ?? null;
  }
  if (payload.amount !== undefined) {
    data.amount = payload.amount;
  }
  if (payload.currency !== undefined) {
    data.currency = payload.currency.toUpperCase();
  }
  if (payload.type !== undefined) {
    data.type = payload.type;
  }
  if (payload.kind !== undefined) {
    data.kind = payload.kind;
  }
  if (payload.category !== undefined) {
    data.category = payload.category?.trim() ?? null;
  }
  if (payload.invoiceNumber !== undefined) {
    data.invoiceNumber = payload.invoiceNumber?.trim() ?? null;
  }
  if (payload.vendor !== undefined) {
    data.vendor = payload.vendor?.trim() ?? null;
  }
  if (payload.memberPaidById !== undefined) {
    data.memberPaidBy = payload.memberPaidById
      ? { connect: { id: payload.memberPaidById } }
      : { disconnect: true };
  }
  if (payload.donationSource !== undefined) {
    data.donationSource = payload.donationSource?.trim() ?? null;
  }
  if (payload.donorContact !== undefined) {
    data.donorContact = payload.donorContact?.trim() ?? null;
  }
  if (payload.tags !== undefined) {
    data.tags = payload.tags;
  }
  if (payload.showId !== undefined) {
    data.show = payload.showId ? { connect: { id: payload.showId } } : { disconnect: true };
  }
  if (payload.budgetId !== undefined) {
    data.budget = payload.budgetId ? { connect: { id: payload.budgetId } } : { disconnect: true };
  }
  if (payload.bookingDate !== undefined) {
    const parsedDate = parseDate(payload.bookingDate);
    if (!parsedDate) {
      return NextResponse.json({ error: "Ungültiges Buchungsdatum" }, { status: 400 });
    }
    data.bookingDate = parsedDate;
  }
  if (payload.dueDate !== undefined) {
    const parsedDate = parseDate(payload.dueDate);
    data.dueDate = parsedDate;
  }
  if (payload.visibilityScope !== undefined) {
    const nextScope = ensureAllowedScope(payload.visibilityScope as VisibilityScope, allowedScopes);
    data.visibilityScope = nextScope;
  }

  if (payload.status !== undefined) {
    if ((payload.status === "approved" || payload.status === "paid") && !canApprove) {
      return NextResponse.json({ error: "Freigabe-Rechte erforderlich" }, { status: 403 });
    }
    if (payload.status !== entry.status) {
      data.status = payload.status;
      data.approvedBy =
        payload.status === "approved" || payload.status === "paid"
          ? { connect: { id: userId } }
          : { disconnect: true };
      data.approvedAt = payload.status === "approved" || payload.status === "paid" ? new Date() : null;
      if (payload.status === "paid") {
        data.paidAt = parseDate(payload.paidAt) ?? new Date();
      } else {
        data.paidAt = payload.paidAt !== undefined ? parseDate(payload.paidAt) : null;
      }
      newStatusLog = {
        fromStatus: entry.status,
        toStatus: payload.status,
        changedBy: { connect: { id: userId } },
        note: null,
      };
    }
  }

  if (payload.paidAt !== undefined && data.paidAt === undefined) {
    const parsedDate = parseDate(payload.paidAt);
    data.paidAt = parsedDate;
  }

  if (payload.attachments) {
    data.attachments = {
      deleteMany: {},
      create: payload.attachments.map((attachment) => ({
        filename: attachment.filename.trim(),
        url: attachment.url,
        mimeType: attachment.mimeType,
        size: attachment.size ?? null,
      })),
    };
  }

  if (Object.keys(data).length === 0 && !newStatusLog) {
    return NextResponse.json({ error: "Keine Änderungen übermittelt" }, { status: 400 });
  }

  if (newStatusLog) {
    data.logs = { create: newStatusLog };
  }

  try {
    const updated = await prisma.financeEntry.update({
      where: { id },
      data,
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

    return NextResponse.json({ entry: mapFinanceEntry(updated as FinanceEntryWithRelations) });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Eintrag konnte nicht aktualisiert werden" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireAuth();
  const [canManage, canApprove] = await Promise.all([
    hasPermission(session.user, "mitglieder.finanzen.manage"),
    hasPermission(session.user, "mitglieder.finanzen.approve"),
  ]);

  if (!canManage) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const entry = await loadEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  const allowedScopes = resolveAllowedVisibilityScopes(session.user, canApprove);
  if (!allowedScopes.includes(entry.visibilityScope)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  await prisma.financeEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
