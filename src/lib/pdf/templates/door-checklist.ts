import { z } from "zod";

import type { PdfTemplate } from "../types";

const doorChecklistSchema = z.object({
  showTitle: z.string().trim().min(1),
  performance: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  capacity: z.number().int().min(0),
  /** Kartenarten für die Strichliste der Abendkasse. */
  categories: z.array(z.string()).default([]),
  rows: z.array(
    z.object({
      name: z.string().trim().min(1),
      code: z.string(),
      summary: z.string(),
      tickets: z.number().int().min(0),
      checkedIn: z.number().int().min(0),
      open: z.string().nullable(),
      note: z.string().nullable(),
      tag: z.string().nullable(),
    }),
  ),
});

type DoorChecklistData = z.infer<typeof doorChecklistSchema>;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Je Karte ein Kästchen zum Abhaken; bei großen Gruppen ein Feld für die Anzahl. */
const MAX_BOXES = 10;

/**
 * Notfall-Einlassliste (Netz oder Akku weg): alphabetisch, ein Kästchen pro Karte, offene Beträge,
 * Hinweise. Am Ende Felder für Abendkassen-Verkäufe zum Mitzählen.
 */
export const doorChecklistTemplate: PdfTemplate<DoorChecklistData> = {
  id: "door-checklist",
  label: "Einlassliste",
  description: "Abhakbare Gästeliste einer Vorstellung für den Notfall.",
  filename: (data) => `einlass-${slugify(data.performance) || "liste"}.pdf`,
  schema: doorChecklistSchema,
  documentOptions: { size: "A4", layout: "portrait", margin: 36 },
  render(doc, data) {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const totalTickets = data.rows.reduce((sum, row) => sum + row.tickets, 0);

    doc.info.Title = `Einlassliste ${data.showTitle} – ${data.performance}`;
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(`Einlass: ${data.showTitle}`);
    doc.font("Helvetica").fontSize(11).fillColor("#374151").text(data.performance);
    doc
      .fontSize(8.5)
      .fillColor("#6b7280")
      .text(
        `${data.rows.length} Reservierungen · ${totalTickets} Karten · ${data.capacity} Plätze · Stand ${data.generatedAt}`,
      );
    doc.moveDown(0.6);

    const columns = { check: 150, name: 150, details: 0, open: 60 };
    columns.details = width - columns.check - columns.name - columns.open;
    const box = 9;
    const gap = 4;

    const header = () => {
      const top = doc.y;
      doc.rect(left, top, width, 16).fill("#111827");
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
      doc.text("Abhaken (je Person)", left + 4, top + 4, { width: columns.check - 8 });
      doc.text("Name", left + columns.check + 4, top + 4, { width: columns.name - 8 });
      doc.text("Karten / Hinweis", left + columns.check + columns.name + 4, top + 4, {
        width: columns.details - 8,
      });
      doc.text("Zahlen", left + width - columns.open + 4, top + 4, { width: columns.open - 8 });
      doc.y = top + 16;
    };

    header();
    data.rows.forEach((row, index) => {
      const detail = [row.summary, row.tag, row.note ? `„${row.note}“` : null]
        .filter(Boolean)
        .join(" · ");
      doc.font("Helvetica").fontSize(8.5);
      const detailHeight = doc.heightOfString(detail, { width: columns.details - 8 });
      const boxRows = row.tickets > MAX_BOXES ? 1 : Math.ceil(row.tickets / 5) || 1;
      const height = Math.max(28, detailHeight + 8, boxRows * (box + gap) + 8);
      if (doc.y + height > bottom()) {
        doc.addPage();
        header();
      }
      const top = doc.y;
      if (index % 2 === 1) doc.rect(left, top, width, height).fill("#f3f4f6");

      // Kästchen
      doc.lineWidth(0.8).strokeColor("#111827");
      if (row.tickets > MAX_BOXES) {
        doc.rect(left + 6, top + 5, 40, box + 2).stroke();
        doc
          .fillColor("#111827")
          .fontSize(8)
          .text(`von ${row.tickets}`, left + 50, top + 6);
      } else {
        for (let i = 0; i < row.tickets; i += 1) {
          const x = left + 6 + (i % 5) * (box + gap);
          const y = top + 5 + Math.floor(i / 5) * (box + gap);
          doc.rect(x, y, box, box).stroke();
          // Schon digital eingelassen: vorab angekreuzt.
          if (i < row.checkedIn) {
            doc
              .moveTo(x + 2, y + 2)
              .lineTo(x + box - 2, y + box - 2)
              .moveTo(x + box - 2, y + 2)
              .lineTo(x + 2, y + box - 2)
              .stroke();
          }
        }
      }

      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9.5);
      doc.text(row.name, left + columns.check + 4, top + 5, {
        width: columns.name - 8,
        ellipsis: true,
        height: height - 6,
      });
      doc.font("Helvetica").fontSize(7).fillColor("#6b7280");
      doc.text(row.code, left + columns.check + 4, top + 17, { width: columns.name - 8 });
      doc.font("Helvetica").fontSize(8.5).fillColor("#374151");
      doc.text(detail, left + columns.check + columns.name + 4, top + 5, {
        width: columns.details - 8,
      });
      if (row.open) {
        doc.font("Helvetica-Bold").fillColor("#111827");
        doc.text(row.open, left + width - columns.open + 4, top + 5, { width: columns.open - 8 });
      }
      doc.y = top + height;
    });

    // Abendkasse zum Mitzählen
    const labels = data.categories.length ? data.categories : ["Karten"];
    if (doc.y + 40 + labels.length * 28 > bottom()) doc.addPage();
    doc.moveDown(1.2);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111827")
      .text("Abendkasse (Strichliste)", left);
    doc.moveDown(0.4);
    for (const label of labels) {
      const top = doc.y;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#111827")
        .text(label, left, top + 6, { width: 90 });
      doc
        .rect(left + 95, top, width - 95, 22)
        .lineWidth(0.6)
        .strokeColor("#9ca3af")
        .stroke();
      doc.y = top + 28;
    }
  },
};
