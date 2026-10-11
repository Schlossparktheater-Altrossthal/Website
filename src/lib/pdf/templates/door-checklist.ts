import { z } from "zod";

import type { PdfTemplate } from "../types";

const rowsSchema = z.array(
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
);

const doorChecklistSchema = z.object({
  showTitle: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  /** Kartenarten für die Strichliste der Abendkasse. */
  categories: z.array(z.string()).default([]),
  /** Je Vorstellung ein Abschnitt, jeder beginnt auf einer neuen Seite. */
  sections: z
    .array(
      z.object({
        performance: z.string().trim().min(1),
        capacity: z.number().int().min(0),
        rows: rowsSchema,
      }),
    )
    .min(1),
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

/** Anfangsbuchstabe für die Trennlinien (Umlaute zum Grundbuchstaben). */
function initial(name: string) {
  const letter = name.trim().normalize("NFKD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : "#";
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
  filename: (data) =>
    `einlass-${
      slugify(data.sections.length === 1 ? data.sections[0].performance : data.showTitle) || "liste"
    }.pdf`,
  schema: doorChecklistSchema,
  documentOptions: { size: "A4", layout: "portrait", margin: 36, bufferPages: true },
  render(doc, data) {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    doc.info.Title =
      data.sections.length === 1
        ? `Einlassliste ${data.showTitle} – ${data.sections[0].performance}`
        : `Einlasslisten ${data.showTitle}`;

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

    data.sections.forEach((section, sectionIndex) => {
      if (sectionIndex > 0) doc.addPage();
      renderSection(section);
    });

    // Seitenzahlen erst am Ende, wenn die Gesamtzahl feststeht.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const marginBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text(
          `${data.showTitle} · Seite ${i - range.start + 1} von ${range.count}`,
          left,
          doc.page.height - marginBottom / 2 - 4,
          { width, align: "center", lineBreak: false },
        );
      doc.page.margins.bottom = marginBottom;
    }

    function renderSection(section: DoorChecklistData["sections"][number]) {
      const totalTickets = section.rows.reduce((sum, row) => sum + row.tickets, 0);
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#111827")
        .text(`Einlass: ${data.showTitle}`, left, doc.page.margins.top);
      doc.font("Helvetica").fontSize(11).fillColor("#374151").text(section.performance);
      doc
        .fontSize(8.5)
        .fillColor("#6b7280")
        .text(
          `${section.rows.length} Reservierungen · ${totalTickets} Karten · ${section.capacity} Plätze · Stand ${data.generatedAt}`,
        );
      doc.moveDown(0.6);

      header();
      let currentInitial: string | null = null;
      section.rows.forEach((row, index) => {
        const detail = [row.summary, row.tag, row.note ? `„${row.note}“` : null]
          .filter(Boolean)
          .join(" · ");
        doc.font("Helvetica").fontSize(8.5);
        const detailHeight = doc.heightOfString(detail, { width: columns.details - 8 });
        const boxRows = row.tickets > MAX_BOXES ? 1 : Math.ceil(row.tickets / 5) || 1;
        const height = Math.max(28, detailHeight + 8, boxRows * (box + gap) + 8);
        const letter = initial(row.name);
        const newLetter = letter !== currentInitial;
        const dividerHeight = newLetter ? 14 : 0;
        if (doc.y + dividerHeight + height > bottom()) {
          doc.addPage();
          header();
        }
        if (newLetter) {
          // Trennlinie mit Buchstabe, wenn ein neuer Anfangsbuchstabe beginnt.
          const lineY = doc.y + 7;
          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor("#111827")
            .text(letter, left + 2, doc.y + 2, { width: 14, lineBreak: false });
          doc
            .moveTo(left + 16, lineY)
            .lineTo(left + width, lineY)
            .lineWidth(1)
            .strokeColor("#111827")
            .stroke();
          doc.y += dividerHeight;
          currentInitial = letter;
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
    }
  },
};
