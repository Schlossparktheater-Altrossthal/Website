import { z } from "zod";

import type { PdfTemplate } from "../types";

const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const generatedAtSchema = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.valueOf()) ? null : parsed;
    }
    return null;
  });

const photoConsentListSchema = z.object({
  showTitle: optionalString,
  generatedAt: generatedAtSchema,
  rows: z.array(
    z.object({
      name: z.string().trim().min(1),
      /** Anzeigetext der Stufe, z. B. „Nur intern“. */
      permission: z.string(),
      exclusionNote: optionalString,
      isMinor: z.boolean(),
    }),
  ),
});

type PhotoConsentListData = z.infer<typeof photoConsentListSchema>;

type PdfDocumentInstance = PDFKit.PDFDocument;

function slugify(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ensureSpace(doc: PdfDocumentInstance, height: number) {
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > pageBottom) {
    doc.addPage();
  }
}

export const photoConsentListTemplate: PdfTemplate<PhotoConsentListData> = {
  id: "photo-consent-list",
  label: "Fotoerlaubnis-Liste",
  description: "Erzeugt die Fotoerlaubnis-Liste einer Produktion als PDF.",
  filename: (data) => {
    const base = slugify(data.showTitle ?? null);
    return base ? `fotoerlaubnis-${base}.pdf` : "fotoerlaubnis-export.pdf";
  },
  schema: photoConsentListSchema,
  documentOptions: { size: "A4", layout: "landscape", margin: 40 },
  render(doc, data) {
    const title = data.showTitle ?? "Fotoerlaubnisse";
    const createdAt = data.generatedAt ?? new Date();

    doc.info.Title = `Fotoerlaubnisse ${title}`;
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Fotoerlaubnisse");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor("#374151").text(`Produktion: ${title}`);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(`Exportiert: ${formatDateTime(createdAt)}`);
    doc.moveDown(0.8);

    const cellPadding = 5;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const nameWidth = 200;
    const permissionWidth = 170;
    const minorWidth = 70;
    const noteWidth = tableWidth - nameWidth - permissionWidth - minorWidth;
    const columns = [
      { label: "Name", width: nameWidth },
      { label: "Fotografieren", width: permissionWidth },
      { label: "Hinweis", width: noteWidth },
      { label: "Minderjährig", width: minorWidth },
    ];

    const headerHeight = 18;
    const rowHeight = 16;

    const drawCells = (values: string[]) => {
      let x = doc.page.margins.left;
      const top = doc.y;
      columns.forEach((column, index) => {
        doc.text(values[index] ?? "", x + cellPadding, top + 4, {
          width: column.width - cellPadding * 2,
          height: rowHeight - 4,
          ellipsis: true,
        });
        x += column.width;
      });
      doc.y = top;
    };

    const drawHeader = () => {
      doc.rect(doc.page.margins.left, doc.y, tableWidth, headerHeight).fill("#111827");
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
      drawCells(columns.map((column) => column.label));
      doc.y += headerHeight;
    };

    const drawRow = (row: PhotoConsentListData["rows"][number]) => {
      ensureSpace(doc, rowHeight);
      doc.font("Helvetica").fontSize(8).fillColor("#111827");
      drawCells([row.name, row.permission, row.exclusionNote ?? "", row.isMinor ? "ja" : ""]);
      doc.y += rowHeight;
    };

    drawHeader();
    for (const row of data.rows) {
      drawRow(row);
    }
  },
};
