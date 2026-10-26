import { z } from "zod";

import { formatCents } from "@/lib/format/money";

import {
  PDF_COLOR,
  PDF_MARGIN,
  drawDocumentHeader,
  drawPageFooters,
  drawSectionTitle,
  drawTable,
  pdfDateTimeFormatter,
  type PdfTableRow,
} from "../layout";
import type { PdfTemplate } from "../types";

const group = z.object({ label: z.string(), incomeCents: z.number(), expenseCents: z.number() });

const kassenberichtSchema = z.object({
  generatedAt: z.string().datetime(),
  period: z.object({
    name: z.string(),
    code: z.string(),
    lockedThrough: z.number(),
    closed: z.boolean(),
  }),
  fund: z.string().nullable(),
  totals: z.object({ incomeCents: z.number(), expenseCents: z.number(), balanceCents: z.number() }),
  openClaims: z.object({ count: z.number(), cents: z.number() }),
  funds: z.array(
    z.object({
      name: z.string(),
      incomeCents: z.number(),
      expenseCents: z.number(),
      balanceCents: z.number(),
    }),
  ),
  byCategory: z.array(group),
  byDepartment: z.array(group),
  donations: z.array(
    z.object({
      label: z.string(),
      date: z.string(),
      donor: z.string(),
      address: z.string().nullable(),
      cents: z.number(),
    }),
  ),
  entries: z.array(
    z.object({
      label: z.string(),
      date: z.string(),
      type: z.enum(["income", "expense", "transfer"]),
      description: z.string(),
      sub: z.string().nullable(),
      fund: z.string(),
      cents: z.number(),
      reversal: z.boolean(),
      reversed: z.boolean(),
    }),
  ),
});

export type KassenberichtPdfData = z.infer<typeof kassenberichtSchema>;

const euro = (cents: number) => (cents ? formatCents(cents) : "—");
const day = (iso: string) => iso.split("-").reverse().join(".");

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed = 60) {
  if (y + needed <= doc.page.height - doc.page.margins.bottom) return y;
  doc.addPage();
  return doc.page.margins.top;
}

function groupRows(groups: z.infer<typeof group>[]): PdfTableRow[] {
  return groups.map((row) => ({
    cells: [
      { text: row.label, bold: true },
      { text: euro(row.incomeCents), color: PDF_COLOR.success },
      { text: euro(row.expenseCents), color: PDF_COLOR.danger },
      { text: formatCents(row.incomeCents - row.expenseCents) },
    ],
  }));
}

const GROUP_COLUMNS = (label: string) => [
  { label, weight: 4 },
  { label: "Einnahmen", weight: 1.6, align: "right" as const },
  { label: "Ausgaben", weight: 1.6, align: "right" as const },
  { label: "Saldo", weight: 1.6, align: "right" as const },
];

/** Kassenbericht je Zeitraum (optional je Topf) für Vorstand, Förderverein und Kassenprüfung. */
export const kassenberichtTemplate: PdfTemplate<KassenberichtPdfData> = {
  id: "kassenbericht",
  label: "Kassenbericht",
  description: "Einnahmen, Ausgaben, Töpfe, Spenden und Kassenbuch eines Abrechnungszeitraums.",
  schema: kassenberichtSchema,
  documentOptions: { size: "A4", margin: PDF_MARGIN, bufferPages: true },
  filename: (data) => `kassenbericht-${data.period.code}${data.fund ? "-topf" : ""}.pdf`,
  render: (doc, data) => {
    const stand = `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`;
    let y = drawDocumentHeader(doc, {
      title: `Kassenbericht ${data.period.name}`,
      meta: [
        data.fund ? `Topf ${data.fund}` : "alle Töpfe",
        data.period.closed
          ? "abgeschlossen"
          : data.period.lockedThrough
            ? `festgeschrieben bis ${data.period.code}-${String(data.period.lockedThrough).padStart(3, "0")}`
            : "nicht festgeschrieben",
        stand,
      ],
    });

    y = drawSectionTitle(doc, "Übersicht", y);
    y = drawTable(doc, {
      y,
      columns: [
        { label: "", weight: 4 },
        { label: "Betrag", weight: 2, align: "right" },
      ],
      rows: [
        {
          cells: [
            "Einnahmen",
            { text: formatCents(data.totals.incomeCents), color: PDF_COLOR.success },
          ],
        },
        {
          cells: [
            "Ausgaben",
            { text: formatCents(data.totals.expenseCents), color: PDF_COLOR.danger },
          ],
        },
        {
          cells: [
            { text: data.fund ? "Saldo des Topfs (inkl. Umbuchungen)" : "Ergebnis", bold: true },
            { text: formatCents(data.totals.balanceCents), bold: true },
          ],
        },
        ...(data.openClaims.count
          ? [
              {
                cells: [
                  {
                    text: `Offene Auslagen (${data.openClaims.count})`,
                    color: PDF_COLOR.muted,
                  },
                  { text: formatCents(data.openClaims.cents), color: PDF_COLOR.muted },
                ],
              },
            ]
          : []),
      ],
    });

    if (!data.fund && data.funds.length) {
      y = ensureSpace(doc, y + 14);
      y = drawSectionTitle(doc, "Töpfe", y, "Zu- und Abflüsse im Zeitraum inkl. Umbuchungen");
      y = drawTable(doc, {
        y,
        columns: GROUP_COLUMNS("Topf").map((column, index) =>
          index === 1
            ? { ...column, label: "Zufluss" }
            : index === 2
              ? { ...column, label: "Abfluss" }
              : column,
        ),
        rows: groupRows(data.funds.map((fund) => ({ ...fund, label: fund.name }))),
      });
    }

    if (data.byCategory.length) {
      y = ensureSpace(doc, y + 14);
      y = drawSectionTitle(doc, "Nach Kategorie", y);
      y = drawTable(doc, {
        y,
        columns: GROUP_COLUMNS("Kategorie"),
        rows: groupRows(data.byCategory),
      });
    }
    if (data.byDepartment.some((row) => row.label !== "Ohne Gewerk")) {
      y = ensureSpace(doc, y + 14);
      y = drawSectionTitle(doc, "Nach Gewerk", y);
      y = drawTable(doc, {
        y,
        columns: GROUP_COLUMNS("Gewerk"),
        rows: groupRows(data.byDepartment),
      });
    }

    if (data.donations.length) {
      y = ensureSpace(doc, y + 14);
      y = drawSectionTitle(doc, "Spenden", y, "Grundlage für Zuwendungsbestätigungen");
      y = drawTable(doc, {
        y,
        columns: [
          { label: "Nr.", weight: 1.2 },
          { label: "Datum", weight: 1.2 },
          { label: "Spender", weight: 5 },
          { label: "Betrag", weight: 1.6, align: "right" },
        ],
        rows: data.donations.map((donation) => ({
          cells: [
            donation.label,
            day(donation.date),
            { text: donation.donor, bold: true, sub: donation.address },
            formatCents(donation.cents),
          ],
        })),
      });
    }

    y = ensureSpace(doc, y + 14);
    y = drawSectionTitle(doc, "Kassenbuch", y, `${data.entries.length} Buchungen`);
    drawTable(doc, {
      y,
      columns: [
        { label: "Nr.", weight: 1.2 },
        { label: "Datum", weight: 1.1 },
        { label: "Buchungstext", weight: 5 },
        { label: "Topf", weight: 1.6 },
        { label: "Einnahme", weight: 1.4, align: "right" },
        { label: "Ausgabe", weight: 1.4, align: "right" },
      ],
      rows: data.entries.map((entry) => ({
        cells: [
          entry.label,
          day(entry.date),
          {
            text: entry.description,
            sub: entry.sub,
            strike: entry.reversed,
            color: entry.reversal || entry.reversed ? PDF_COLOR.muted : PDF_COLOR.text,
          },
          entry.fund,
          entry.type === "income"
            ? { text: formatCents(entry.cents), color: PDF_COLOR.success }
            : "",
          entry.type === "expense"
            ? { text: formatCents(entry.cents), color: PDF_COLOR.danger }
            : entry.type === "transfer"
              ? { text: formatCents(entry.cents), color: PDF_COLOR.muted }
              : "",
        ],
      })),
    });

    drawPageFooters(
      doc,
      `Kassenbericht ${data.period.name}${data.fund ? ` · ${data.fund}` : ""} · ${stand}`,
    );
  },
};
