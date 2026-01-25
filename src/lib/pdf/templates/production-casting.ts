import { z } from "zod";

import type { PdfTemplate } from "../types";

const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const castingExportSchema = z.object({
  showTitle: optionalString,
  generatedAt: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform((value) => {
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

type PdfDocumentInstance = import("pdfkit");

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
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text("Besetzung", { align: "left" });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(12).fillColor("#374151").text(`Produktion: ${title}`);
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(`Exportiert: ${formatDateTime(createdAt)}`);
    doc.moveDown(1);

    data.roles.forEach((role, index) => {
      ensureSpace(doc, 80);
      if (index > 0) {
        doc.moveDown(0.3);
        doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
        doc.moveDown(0.4);
      }

      doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(role.name, { continued: false });
      if (role.shortName) {
        doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(`Kurzname: ${role.shortName}`);
      }
      if (role.description) {
        doc.font("Helvetica").fontSize(10).fillColor("#374151").text(role.description);
      }
      if (role.notes) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6b7280").text(`Notiz: ${role.notes}`);
      }

      doc.moveDown(0.3);
      if (role.castings.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text("Keine Besetzung hinterlegt.");
        return;
      }

      role.castings.forEach((casting) => {
        ensureSpace(doc, 32);
        const label = formatType(casting.type, casting.typeLabel);
        const line = `• ${casting.name} (${label})`;
        doc.font("Helvetica").fontSize(10).fillColor("#111827").text(line);
        if (casting.notes) {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6b7280").text(`  Notiz: ${casting.notes}`);
        }
      });
    });
  },
};
