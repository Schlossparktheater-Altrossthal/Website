import type { FinanceEntryType } from "@prisma/client";

import { loadBook, type EntryView } from "@/lib/finance/book";
import { renderPdfTemplate } from "@/lib/pdf/engine";
import type { KassenberichtPdfData } from "@/lib/pdf/templates/kassenbericht";
import { FINANCE_ENTRY_TYPE_LABELS } from "@/lib/finance/constants";
import { prisma } from "@/lib/prisma";

/** Berichte & Export (docs/Plan/finanzen-plan.md, Phase 6): Kassenbericht, CSV, Belege. */

export type ReportGroup = { label: string; incomeCents: number; expenseCents: number };

export type FinanceReport = {
  period: { id: string; name: string; code: string; lockedThrough: number; closed: boolean };
  fund: { id: string; name: string } | null;
  totals: { incomeCents: number; expenseCents: number; balanceCents: number };
  byCategory: ReportGroup[];
  byDepartment: ReportGroup[];
  funds: { name: string; incomeCents: number; expenseCents: number; balanceCents: number }[];
  donations: {
    label: string;
    date: string;
    donor: string;
    address: string | null;
    cents: number;
  }[];
  openClaims: { count: number; cents: number };
  entries: EntryView[];
};

type GroupInput = Pick<EntryView, "type" | "amountCents" | "reversalOf">;

/** Einnahmen/Ausgaben je Schlüssel; Stornos mindern ihre ursprüngliche Richtung, Umbuchungen fehlen. */
export function groupTotals<T extends GroupInput>(
  entries: T[],
  key: (entry: T) => string,
): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const entry of entries) {
    if (entry.type === "transfer") continue;
    const label = key(entry);
    const group = groups.get(label) ?? { label, incomeCents: 0, expenseCents: 0 };
    const reversal = Boolean(entry.reversalOf);
    if (entry.type === "income") {
      if (reversal) group.expenseCents -= entry.amountCents;
      else group.incomeCents += entry.amountCents;
    } else if (reversal) group.incomeCents -= entry.amountCents;
    else group.expenseCents += entry.amountCents;
    groups.set(label, group);
  }
  return [...groups.values()]
    .filter((group) => group.incomeCents || group.expenseCents)
    .sort((a, b) => b.incomeCents + b.expenseCents - (a.incomeCents + a.expenseCents));
}

/** Zufluss/Abfluss je Topf im Zeitraum (inkl. Umbuchungen). */
export function fundTotals(entries: EntryView[]) {
  const funds = new Map<string, { name: string; incomeCents: number; expenseCents: number }>();
  const add = (fund: { id: string; name: string }, cents: number) => {
    const row = funds.get(fund.id) ?? { name: fund.name, incomeCents: 0, expenseCents: 0 };
    if (cents > 0) row.incomeCents += cents;
    else row.expenseCents -= cents;
    funds.set(fund.id, row);
  };
  for (const entry of entries) {
    if (entry.type === "income") add(entry.fund, entry.amountCents);
    else if (entry.type === "expense") add(entry.fund, -entry.amountCents);
    else if (entry.transferFund) {
      add(entry.fund, -entry.amountCents);
      add(entry.transferFund, entry.amountCents);
    }
  }
  return [...funds.values()]
    .map((row) => ({ ...row, balanceCents: row.incomeCents - row.expenseCents }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function loadFinanceReport(
  periodId: string,
  fundId: string | null,
): Promise<FinanceReport> {
  const { period, entries, totals } = await loadBook({ periodId, fundId });
  const ordered = [...entries].sort((a, b) => a.number - b.number);
  const [fund, claims] = await Promise.all([
    fundId
      ? prisma.financeFund.findUnique({ where: { id: fundId }, select: { id: true, name: true } })
      : null,
    prisma.expenseClaim.findMany({
      where: { periodId, status: { in: ["submitted", "approved"] } },
      select: { amountCents: true },
    }),
  ]);
  const reversed = new Set(ordered.filter((entry) => entry.reversedBy).map((entry) => entry.id));
  return {
    period: {
      id: period.id,
      name: period.name,
      code: period.code,
      lockedThrough: period.lockedThrough,
      closed: Boolean(period.closedAt),
    },
    fund,
    totals,
    byCategory: groupTotals(ordered, (entry) => entry.category?.name ?? "Ohne Kategorie"),
    byDepartment: groupTotals(ordered, (entry) => entry.department?.name ?? "Ohne Gewerk"),
    funds: fundTotals(ordered),
    donations: ordered
      .filter(
        (entry) =>
          entry.type === "income" &&
          !entry.reversalOf &&
          !reversed.has(entry.id) &&
          (entry.source === "donation" || entry.donorName),
      )
      .map((entry) => ({
        label: entry.label,
        date: entry.bookingDate,
        donor: entry.donorName ?? entry.counterparty ?? "Spendenkasse",
        address: entry.donorAddress,
        cents: entry.amountCents,
      })),
    openClaims: {
      count: claims.length,
      cents: claims.reduce((sum, claim) => sum + claim.amountCents, 0),
    },
    entries: ordered,
  };
}

function csvCell(value: string): string {
  // Formeln in Tabellenprogrammen verhindern (CSV-Injection).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Cent als „1234,56“ ohne Tausenderpunkt – rechnet in Excel/LibreOffice. */
export function centsForCsv(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function germanDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

const TYPE_LABELS: Record<FinanceEntryType, string> = FINANCE_ENTRY_TYPE_LABELS;

/** Kassenbuch als CSV (Semikolon, UTF-8 mit BOM), Einnahme und Ausgabe in getrennten Spalten. */
export function entriesToCsv(entries: EntryView[]): string {
  const header = [
    "Nr.",
    "Datum",
    "Art",
    "Buchungstext",
    "Gegenüber",
    "Kategorie",
    "Gewerk",
    "Topf",
    "Ziel-Topf",
    "Einnahme",
    "Ausgabe",
    "Storno von",
    "Storniert durch",
    "Belege",
    "Festgeschrieben",
    "Erfasst von",
  ];
  const lines = entries.map((entry) =>
    [
      entry.label,
      germanDate(entry.bookingDate),
      TYPE_LABELS[entry.type],
      entry.description,
      entry.counterparty ?? "",
      entry.category?.name ?? "",
      entry.department?.name ?? "",
      entry.fund.name,
      entry.transferFund?.name ?? "",
      entry.type === "income" ? centsForCsv(entry.amountCents) : "",
      entry.type === "expense" ? centsForCsv(entry.amountCents) : "",
      entry.reversalOf ?? "",
      entry.reversedBy ?? "",
      String(entry.receipts.length),
      entry.locked ? "ja" : "nein",
      entry.createdBy,
    ]
      .map(csvCell)
      .join(";"),
  );
  return `﻿${[header.map(csvCell).join(";"), ...lines].join("\r\n")}\r\n`;
}

/** Dateiname ohne Sonderzeichen, z. B. „kassenbuch-S27-barkasse“. */
export function reportFileBase(kind: string, report: Pick<FinanceReport, "period" | "fund">) {
  const fund = report.fund?.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return [kind, report.period.code, fund].filter(Boolean).join("-");
}

/** Belege der Buchungen als ZIP, Dateien nach Buchungsnummer benannt. */
export async function receiptsZip(report: FinanceReport): Promise<Uint8Array | null> {
  const ids = report.entries.flatMap((entry) => entry.receipts.map((receipt) => receipt.id));
  if (!ids.length) return null;
  const { zipSync } = await import("fflate");
  const receipts = await prisma.financeReceipt.findMany({
    where: { id: { in: ids } },
    select: { id: true, entryId: true, claimId: true, filename: true, data: true },
  });
  const byId = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const files: Record<string, Uint8Array> = {};
  for (const entry of report.entries) {
    entry.receipts.forEach((meta, index) => {
      const receipt = byId.get(meta.id);
      if (!receipt) return;
      const safe = receipt.filename.replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 120);
      const suffix = entry.receipts.length > 1 ? `-${index + 1}` : "";
      files[`${entry.label}${suffix}_${safe}`] = new Uint8Array(receipt.data);
    });
  }
  return zipSync(files, { level: 0 });
}

/** Bericht in die Daten der PDF-Vorlage „kassenbericht“ umsetzen. */
export function reportToPdfData(report: FinanceReport, now = new Date()): KassenberichtPdfData {
  return {
    generatedAt: now.toISOString(),
    period: report.period,
    fund: report.fund?.name ?? null,
    totals: report.totals,
    openClaims: report.openClaims,
    funds: report.funds,
    byCategory: report.byCategory,
    byDepartment: report.byDepartment,
    donations: report.donations,
    entries: report.entries.map((entry) => ({
      label: entry.label,
      date: entry.bookingDate,
      type: entry.type,
      description: entry.description,
      sub:
        [
          entry.transferFund ? `Umbuchung nach ${entry.transferFund.name}` : null,
          entry.counterparty,
          entry.category?.name,
          entry.department?.name,
          entry.reversalOf ? `Storno von ${entry.reversalOf}` : null,
          entry.reversedBy ? `storniert durch ${entry.reversedBy}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      fund: entry.fund.name,
      cents: entry.amountCents,
      reversal: Boolean(entry.reversalOf),
      reversed: Boolean(entry.reversedBy),
    })),
  };
}

export async function renderFinanceReportPdf(report: FinanceReport) {
  const result = await renderPdfTemplate("kassenbericht", reportToPdfData(report));
  return { buffer: result.buffer, filename: `${reportFileBase("kassenbericht", report)}.pdf` };
}
