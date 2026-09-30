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
  purposes: z.array(z.string().trim().min(1)),
  rows: z.array(
    z.object({
      name: z.string().trim().min(1),
      permission: z.string(),
      status: z.string(),
      exclusionNote: optionalString,
      isMinor: z.boolean(),
      purposes: z.array(z.object({ label: z.string(), chosen: z.boolean() })),
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
    const nameWidth = 150;
    const statusWidth = 72;
    const exclusionWidth = 110;
    const purposes = data.purposes;
    const remainingWidth =
      doc.page.width -
      doc.page.margins.left -
      doc.page.margins.right -
      nameWidth -
      statusWidth -
      exclusionWidth;
    const purposeWidth = purposes.length
      ? Math.floor(remainingWidth / purposes.length)
      : remainingWidth;

    const headerHeight = 18;
    const rowHeight = 16;

    const drawHeader = () => {
      doc.font("Helvetica-Bold").fontSize(8);
      doc.fillColor("#ffffff");
      doc
        .rect(
          doc.page.margins.left,
          doc.y,
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
          headerHeight,
        )
        .fill("#111827");
      doc.fillColor("#ffffff");
      let x = doc.page.margins.left;
      doc.text("Name", x + cellPadding, doc.y + 6, { width: nameWidth - cellPadding * 2 });
      x += nameWidth;
      doc.text("Fotoerlaubnis", x + cellPadding, doc.y + 6, {
        width: statusWidth - cellPadding * 2,
      });
      x += statusWidth;
      for (const purpose of purposes) {
        doc.text(purpose, x + cellPadding, doc.y + 6, {
          width: purposeWidth - cellPadding * 2,
          height: headerHeight - 4,
          ellipsis: true,
        });
        x += purposeWidth;
      }
      doc.text("Ausschlüsse", x + cellPadding, doc.y + 6, {
        width: exclusionWidth - cellPadding * 2,
      });
      doc.y += headerHeight;
    };

    const drawRow = (row: PhotoConsentListData["rows"][number]) => {
      ensureSpace(doc, rowHeight);
      let x = doc.page.margins.left;
      doc.font("Helvetica").fontSize(8).fillColor("#111827");
      doc.text(row.name, x + cellPadding, doc.y + 4, {
        width: nameWidth - cellPadding * 2,
        height: rowHeight - 4,
        ellipsis: true,
      });
      x += nameWidth;
      doc.text(row.status, x + cellPadding, doc.y + 4, {
        width: statusWidth - cellPadding * 2,
        height: rowHeight - 4,
        ellipsis: true,
      });
      x += statusWidth;
      const chosenByLabel = new Map(row.purposes.map((purpose) => [purpose.label, purpose.chosen]));
      for (const purpose of purposes) {
        const chosen = chosenByLabel.get(purpose) ?? false;
        doc.text(chosen ? "x" : "", x + cellPadding, doc.y + 4, {
          width: purposeWidth - cellPadding * 2,
          height: rowHeight - 4,
          align: "center",
        });
        x += purposeWidth;
      }
      doc.text(row.exclusionNote ?? "", x + cellPadding, doc.y + 4, {
        width: exclusionWidth - cellPadding * 2,
        height: rowHeight - 4,
        ellipsis: true,
      });
      doc.y += rowHeight;
    };

    drawHeader();
    for (const row of data.rows) {
      drawRow(row);
    }
  },
};
