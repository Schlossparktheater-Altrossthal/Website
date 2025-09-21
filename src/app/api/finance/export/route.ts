import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { FINANCE_EXPORT_FILENAME, isFinanceEntryKind, isFinanceEntryStatus, isFinanceType } from "@/lib/finance";
import { mapFinanceEntry, resolveAllowedVisibilityScopes } from "../utils";

function parseDate(input: string | null): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!/[",\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await requireAuth();
  const [canView, canApprove, canExport] = await Promise.all([
    hasPermission(session.user, "mitglieder.finanzen"),
    hasPermission(session.user, "mitglieder.finanzen.approve"),
    hasPermission(session.user, "mitglieder.finanzen.export"),
  ]);

  if (!canView || !canExport) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const allowedScopes = resolveAllowedVisibilityScopes(session.user, canApprove);
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const kindParam = url.searchParams.get("kind");
  const typeParam = url.searchParams.get("type");
  const showParam = url.searchParams.get("showId");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const where: Prisma.FinanceEntryWhereInput = {
    visibilityScope: { in: allowedScopes },
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

  const fromDate = parseDate(fromParam);
  const toDate = parseDate(toParam);
  if (fromDate || toDate) {
    where.bookingDate = {};
    if (fromDate) where.bookingDate.gte = fromDate;
    if (toDate) where.bookingDate.lte = toDate;
  }

  const entries = await prisma.financeEntry.findMany({
    where,
    orderBy: { bookingDate: "asc" },
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

  const rows = entries.map((entry) => mapFinanceEntry(entry));

  const header = [
    "ID",
    "Titel",
    "Art",
    "Typ",
    "Status",
    "Betrag",
    "Währung",
    "Kategorie",
    "Buchungsdatum",
    "Fälligkeit",
    "Bezahlt am",
    "Rechnungsnummer",
    "Anbieter",
    "Mitglied",
    "Spendenquelle",
    "Spenderkontakt",
    "Show",
    "Budget",
    "Sichtbarkeit",
    "Anhänge",
  ];

  const csvLines = [header.map(escapeCsv).join(",")];

  for (const entry of rows) {
    const attachments = entry.attachments.map((attachment) => attachment.url ?? attachment.filename).filter(Boolean).join(" | ");
    csvLines.push(
      [
        entry.id,
        entry.title,
        entry.kind,
        entry.type,
        entry.status,
        entry.amount.toFixed(2),
        entry.currency,
        entry.category ?? "",
        entry.bookingDate,
        entry.dueDate ?? "",
        entry.paidAt ?? "",
        entry.invoiceNumber ?? "",
        entry.vendor ?? "",
        entry.memberPaidBy?.name ?? entry.memberPaidBy?.email ?? "",
        entry.donationSource ?? "",
        entry.donorContact ?? "",
        entry.show ? `${entry.show.year ?? ""} ${entry.show.title ?? ""}`.trim() : "",
        entry.budget ? `${entry.budget.category}` : "",
        entry.visibilityScope,
        attachments,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  const csvContent = csvLines.join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${FINANCE_EXPORT_FILENAME}`,
    },
  });
}
