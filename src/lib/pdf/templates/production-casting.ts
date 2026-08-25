import { z } from "zod";

import type { PdfTemplate } from "../types";

const optionalString = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
});

const castingExportSchema = z.object({
  showTitle: optionalString,
  generatedAt: z.union([z.string(), z.date(), z.null(), z.undefined()]).transform((value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.valueOf()) ? null : value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.valueOf()) ? null : parsed;
    }
    return null;
  }),
  roles: z.array(
    z.object({
      name: z.string().trim().min(1),
      shortName: optionalString,
      description: optionalString,
      notes: optionalString,
      color: optionalString,
      castings: z.array(
        z.object({
          name: z.string().trim().min(1),
          type: optionalString,
          typeLabel: optionalString,
          notes: optionalString,
        }),
      ),
    }),
  ),
});

type CastingExportData = z.infer<typeof castingExportSchema>;

type PdfDocumentInstance = PDFKit.PDFDocument;

const TYPE_LABELS: Record<string, string> = {
  primary: "Primär",
  alternate: "Sekundär",
};

function slugify(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 60);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatType(type: string | null | undefined, label?: string | null) {
  if (label) return label;
  if (!type) return "Weitere";
  return TYPE_LABELS[type] ?? "Weitere";
}

function ensureSpace(doc: PdfDocumentInstance, height: number) {
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > pageBottom) {
    doc.addPage();
  }
}

export const productionCastingTemplate: PdfTemplate<CastingExportData> = {
  id: "production-casting",
  label: "Besetzungsliste",
  description: "Erzeugt eine Besetzungsliste als PDF.",
  filename: (data) => {
    const base = slugify(data.showTitle ?? null);
    return base ? `besetzung-${base}.pdf` : "besetzung-export.pdf";
  },
  schema: castingExportSchema,
  async render(doc, data) {
    const title = data.showTitle ?? "Besetzung";
    const createdAt = data.generatedAt ?? new Date();

    doc.info.Title = `Besetzung ${title}`;
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#111827")
      .text("Besetzung", { align: "left" });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(12).fillColor("#374151").text(`Produktion: ${title}`);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text(`Exportiert: ${formatDateTime(createdAt)}`);
    doc.moveDown(1);

    const tableX = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const roleColumnWidth = Math.floor(tableWidth * 0.4);
    const castingColumnWidth = tableWidth - roleColumnWidth;
    const cellPadding = 6;

    const drawTableHeader = () => {
      const headerFontSize = 10;
      doc.font("Helvetica-Bold").fontSize(headerFontSize);
      const headerHeight =
        Math.max(
          doc.heightOfString("Rolle", { width: roleColumnWidth - cellPadding * 2 }),
          doc.heightOfString("Schauspieler", { width: castingColumnWidth - cellPadding * 2 }),
        ) +
        cellPadding * 2;

      ensureSpace(doc, headerHeight);

      const y = doc.y;
      doc.save();
      doc.rect(tableX, y, tableWidth, headerHeight).fill("#f3f4f6");
      doc.restore();
      doc.fillColor("#111827");
      doc.text("Rolle", tableX + cellPadding, y + cellPadding, {
        width: roleColumnWidth - cellPadding * 2,
      });
      doc.text("Schauspieler", tableX + roleColumnWidth + cellPadding, y + cellPadding, {
        width: castingColumnWidth - cellPadding * 2,
      });
      doc.strokeColor("#e5e7eb").lineWidth(1).rect(tableX, y, tableWidth, headerHeight).stroke();
      doc
        .moveTo(tableX + roleColumnWidth, y)
        .lineTo(tableX + roleColumnWidth, y + headerHeight)
        .stroke();
      doc.y = y + headerHeight;
    };

    const drawRow = (roleText: string, castingText: string) => {
      doc.font("Helvetica").fontSize(10).fillColor("#111827");
      const leftHeight = doc.heightOfString(roleText, { width: roleColumnWidth - cellPadding * 2 });
      const rightHeight = doc.heightOfString(castingText, {
        width: castingColumnWidth - cellPadding * 2,
      });
      const rowHeight = Math.max(leftHeight, rightHeight) + cellPadding * 2;
      const pageBottom = doc.page.height - doc.page.margins.bottom;

      if (doc.y + rowHeight > pageBottom) {
        doc.addPage();
        drawTableHeader();
      }

      const y = doc.y;
      doc.strokeColor("#e5e7eb").lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
      doc
        .moveTo(tableX + roleColumnWidth, y)
        .lineTo(tableX + roleColumnWidth, y + rowHeight)
        .stroke();
      doc.fillColor("#111827");
      doc.text(roleText, tableX + cellPadding, y + cellPadding, {
        width: roleColumnWidth - cellPadding * 2,
      });
      doc.text(castingText, tableX + roleColumnWidth + cellPadding, y + cellPadding, {
        width: castingColumnWidth - cellPadding * 2,
      });
      doc.y = y + rowHeight;
    };

    drawTableHeader();

    data.roles.forEach((role) => {
      const roleLines = [role.name];
      if (role.shortName) {
        roleLines.push(`Kurzname: ${role.shortName}`);
      }
      if (role.description) {
        roleLines.push(role.description);
      }
      if (role.notes) {
        roleLines.push(`Notiz: ${role.notes}`);
      }
      const roleText = roleLines.join("\n");

      const castingLines =
        role.castings.length === 0
          ? ["Keine Besetzung"]
          : role.castings.map((casting) => {
              const label = formatType(casting.type, casting.typeLabel);
              const baseLine = `${casting.name} (${label})`;
              return casting.notes ? `${baseLine} – Notiz: ${casting.notes}` : baseLine;
            });
      const castingText = castingLines.join("\n");

      drawRow(roleText, castingText);
    });
  },
};
