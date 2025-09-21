import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FinanceEntryStatus, Prisma, VisibilityScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { isFinanceEntryKind, isFinanceEntryStatus, isFinanceType } from "@/lib/finance";
import {
  mapFinanceEntry,
  resolveAllowedVisibilityScopes,
  type FinanceEntryWithRelations,
} from "./utils";

const MAX_RESULTS = 200;
const DEFAULT_STATUS_FILTER: FinanceEntryStatus[] = ["draft", "pending", "approved", "paid"];

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
  const url = request.nextUrl;
  const statusParam = url.searchParams.get("status");
  const kindParam = url.searchParams.get("kind");
  const typeParam = url.searchParams.get("type");
  const showParam = url.searchParams.get("showId");
  const budgetParam = url.searchParams.get("budgetId");
  const searchParam = url.searchParams.get("q");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const where: Prisma.FinanceEntryWhereInput = {
    visibilityScope: { in: allowedScopes },
    status: { in: DEFAULT_STATUS_FILTER },
  };

  if (statusParam && isFinanceEntryStatus(statusParam)) {
    where.status = statusParam;
  }

  if (kindParam && isFinanceEntryKind(kindParam)) {
    where.kind = kindParam;
  }

  if (typeParam && isFinanceType(typeParam)) {
    where.type = typeParam;
  }

  if (showParam) {
    where.showId = showParam;
  }

  if (budgetParam) {
    where.budgetId = budgetParam;
  }

  const fromDate = parseDate(fromParam);
  const toDate = parseDate(toParam);
  if (fromDate || toDate) {
    where.bookingDate = {};
    if (fromDate) {
      where.bookingDate.gte = fromDate;
    }
    if (toDate) {
      where.bookingDate.lte = toDate;
    }
  }

  if (searchParam && searchParam.trim()) {
    const term = searchParam.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { invoiceNumber: { contains: term, mode: "insensitive" } },
      { vendor: { contains: term, mode: "insensitive" } },
      { donationSource: { contains: term, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.financeEntry.findMany({
    where,
    orderBy: { bookingDate: "desc" },
    take: MAX_RESULTS,
    include: {
      show: { select: { id: true, title: true, year: true } },
      budget: { include: { show: { select: { id: true, title: true, year: true } } } },
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      memberPaidBy: { select: { id: true, name: true, email: true } },
      attachments: true,
      logs: {
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({ entries: entries.map(mapFinanceEntry) });
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

const payloadSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional().nullable(),
  amount: z.number().finite().nonnegative(),
  currency: z.string().trim().min(1).max(10).default("EUR"),
  type: z.enum(["income", "expense"] as const),
  kind: z.enum(["general", "invoice", "donation"] as const).default("general"),
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
});

export async function POST(request: NextRequest) {
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

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = parsed.data;
  const allowedScopes = resolveAllowedVisibilityScopes(session.user, canApprove);
  const status = payload.status ?? (payload.kind === "invoice" ? "pending" : payload.kind === "donation" ? "approved" : "draft");

  if ((status === "approved" || status === "paid") && !canApprove) {
    return NextResponse.json({ error: "Freigabe-Rechte erforderlich" }, { status: 403 });
  }

  if (payload.kind === "invoice" && !payload.memberPaidById) {
    return NextResponse.json({ error: "Für Rechnungen muss ein zahlendes Mitglied angegeben werden." }, { status: 400 });
  }

  if (payload.kind === "donation" && !payload.donationSource) {
    return NextResponse.json({ error: "Spenden benötigen eine Quelle." }, { status: 400 });
  }

  const bookingDate = parseDate(payload.bookingDate) ?? new Date();
  const dueDate = parseDate(payload.dueDate);
  const paidAt = status === "paid" ? parseDate(payload.paidAt) ?? new Date() : parseDate(payload.paidAt);

  const visibilityScope = ensureAllowedScope(payload.visibilityScope as VisibilityScope | undefined, allowedScopes);

  try {
    const entry = await prisma.financeEntry.create({
      data: {
        title: payload.title.trim(),
        description: payload.description?.trim() ?? null,
        amount: payload.amount,
        currency: payload.currency.toUpperCase(),
        type: payload.type,
        kind: payload.kind,
        status,
        category: payload.category?.trim() ?? null,
        bookingDate,
        dueDate,
        paidAt: status === "paid" ? paidAt : null,
        invoiceNumber: payload.invoiceNumber?.trim() ?? null,
        vendor: payload.vendor?.trim() ?? null,
        memberPaidById: payload.memberPaidById ?? null,
        donationSource: payload.donationSource?.trim() ?? null,
        donorContact: payload.donorContact?.trim() ?? null,
        tags: payload.tags ?? null,
        showId: payload.showId ?? null,
        budgetId: payload.budgetId ?? null,
        visibilityScope,
        createdById: userId,
        approvedById: status === "approved" || status === "paid" ? userId : null,
        approvedAt: status === "approved" || status === "paid" ? new Date() : null,
        attachments: payload.attachments?.length
          ? {
              create: payload.attachments.map((attachment) => ({
                filename: attachment.filename.trim(),
                url: attachment.url,
                mimeType: attachment.mimeType,
                size: attachment.size ?? null,
              })),
            }
          : undefined,
        logs: {
          create: {
            fromStatus: null,
            toStatus: status,
            changedBy: { connect: { id: userId } },
          },
        },
      },
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

    return NextResponse.json({ entry: mapFinanceEntry(entry as FinanceEntryWithRelations) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Ungültige Eingabe" }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Eintrag konnte nicht gespeichert werden" }, { status: 400 });
  }
}
