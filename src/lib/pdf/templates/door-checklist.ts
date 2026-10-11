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
  documentOptions: { size: "A4", layout: "portrait", margin: 28, bufferPages: true },
  render(doc, data) {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    doc.info.Title =
      data.sections.length === 1
        ? `Einlassliste ${data.showTitle} – ${data.sections[0].performance}`
        : `Einlasslisten ${data.showTitle}`;

    // Kompakt für mehrere Hundert Gäste: eine Zeile pro Reservierung, Kästchen nebeneinander.
    const box = 8;
    const gap = 2.5;
    const columns = { check: MAX_BOXES * (box + gap) + 6, name: 150, details: 0, open: 52 };
    columns.details = width - columns.check - columns.name - columns.open;
    const rowPad = 3;
    const minRowHeight = 13;

    const header = () => {
      const top = doc.y;
      doc.rect(left, top, width, 12).fill("#111827");
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff");
      doc.text("Abhaken (je Person)", left + 3, top + 3, { width: columns.check - 6 });
      doc.text("Name · Code", left + columns.check + 3, top + 3, { width: columns.name - 6 });
      doc.text("Karten / Hinweis", left + columns.check + columns.name + 3, top + 3, {
        width: columns.details - 6,
      });
      doc.text("Zahlen", left + width - columns.open + 3, top + 3, {
        width: columns.open - 6,
        align: "right",
      });
      doc.y = top + 12;
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
      const titleTop = doc.page.margins.top;
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#111827")
        .text(`Einlass: ${data.showTitle} – ${section.performance}`, left, titleTop, { width });
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#6b7280")
        .text(
          `${section.rows.length} Reservierungen · ${totalTickets} Karten · ${section.capacity} Plätze · Stand ${data.generatedAt}`,
          left,
        );
      doc.moveDown(0.3);

      header();
      let currentInitial: string | null = null;
      let stripe = false;
      section.rows.forEach((row) => {
        const detail = [row.summary, row.tag, row.note ? `„${row.note}“` : null]
          .filter(Boolean)
          .join(" · ");
        doc.font("Helvetica").fontSize(7.5);
        const detailHeight = doc.heightOfString(detail, { width: columns.details - 6 });
        const height = Math.max(minRowHeight, detailHeight + rowPad * 2 - 1);
        const letter = initial(row.name);
        const newLetter = letter !== currentInitial;
        const dividerHeight = newLetter ? 10 : 0;
        if (doc.y + dividerHeight + height > bottom()) {
          doc.addPage();
          header();
        }
        if (newLetter) {
          // Trennlinie mit Buchstabe, wenn ein neuer Anfangsbuchstabe beginnt.
          const dividerTop = doc.y;
          const lineY = dividerTop + 5.5;
          doc
            .font("Helvetica-Bold")
            .fontSize(7.5)
            .fillColor("#111827")
            .text(letter, left + 1, dividerTop + 2, { width: 10, lineBreak: false });
          doc
            .moveTo(left + 11, lineY)
            .lineTo(left + width, lineY)
            .lineWidth(0.6)
            .strokeColor("#111827")
            .stroke();
          doc.y = dividerTop + dividerHeight;
          currentInitial = letter;
          stripe = false;
        }
        const top = doc.y;
        if (stripe) doc.rect(left, top, width, height).fill("#f3f4f6");
        stripe = !stripe;

        // Kästchen
        doc.lineWidth(0.6).strokeColor("#111827");
        const boxTop = top + (minRowHeight - box) / 2;
        if (row.tickets > MAX_BOXES) {
          doc.rect(left + 3, boxTop - 0.5, 30, box + 1).stroke();
          doc
            .font("Helvetica")
            .fillColor("#111827")
            .fontSize(7.5)
            .text(`von ${row.tickets}`, left + 37, top + rowPad, { lineBreak: false });
        } else {
          for (let i = 0; i < row.tickets; i += 1) {
            const x = left + 3 + i * (box + gap);
            doc.rect(x, boxTop, box, box).stroke();
            // Schon digital eingelassen: vorab angekreuzt.
            if (i < row.checkedIn) {
              doc
                .moveTo(x + 1.5, boxTop + 1.5)
                .lineTo(x + box - 1.5, boxTop + box - 1.5)
                .moveTo(x + box - 1.5, boxTop + 1.5)
                .lineTo(x + 1.5, boxTop + box - 1.5)
                .stroke();
            }
          }
        }

        // Name fett, Code klein dahinter
        const nameX = left + columns.check + 3;
        const nameWidth = columns.name - 6;
        doc.font("Helvetica").fontSize(6.5);
        const codeWidth = doc.widthOfString(row.code);
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111827");
        const nameMax = Math.max(20, nameWidth - codeWidth - 4);
        doc.text(row.name, nameX, top + rowPad - 0.5, {
          width: nameMax,
          height: 10,
          ellipsis: true,
          lineBreak: false,
        });
        const nameUsed = Math.min(doc.widthOfString(row.name), nameMax);
        doc
          .font("Helvetica")
          .fontSize(6.5)
          .fillColor("#6b7280")
          .text(row.code, nameX + nameUsed + 4, top + rowPad + 1, { lineBreak: false });

        doc.font("Helvetica").fontSize(7.5).fillColor("#374151");
        doc.text(detail, left + columns.check + columns.name + 3, top + rowPad, {
          width: columns.details - 6,
        });
        if (row.open) {
          doc.font("Helvetica-Bold").fillColor("#111827");
          doc.text(row.open, left + width - columns.open + 3, top + rowPad, {
            width: columns.open - 6,
            align: "right",
          });
        }
        doc.y = top + height;
      });

      // Abendkasse zum Mitzählen
      const labels = data.categories.length ? data.categories : ["Karten"];
      if (doc.y + 30 + labels.length * 22 > bottom()) doc.addPage();
      doc.moveDown(0.8);
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor("#111827")
        .text("Abendkasse (Strichliste)", left);
      doc.moveDown(0.4);
      for (const label of labels) {
        const top = doc.y;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#111827")
          .text(label, left, top + 5, { width: 90 });
        doc
          .rect(left + 95, top, width - 95, 18)
          .lineWidth(0.6)
          .strokeColor("#9ca3af")
          .stroke();
        doc.y = top + 22;
      }
    }
  },
};
