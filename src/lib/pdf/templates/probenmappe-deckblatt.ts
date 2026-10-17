import { z } from "zod";

import { PDF_BOLD, PDF_COLOR, PDF_MARGIN, pdfDateTimeFormatter, textLine } from "../layout";
import type { PdfTemplate } from "../types";

const probenmappeDeckblattSchema = z.object({
  generatedAt: z.string().datetime(),
  production: z.string().nullable().default(null),
  /** Inhalt in Mappen-Reihenfolge; `page` = erste Seite in der fertigen Mappe. */
  parts: z.array(z.object({ label: z.string(), page: z.number().int().positive() })),
  /** Gewählte Teile, für die es (noch) keine Daten gibt. */
  missing: z.array(z.string()).default([]),
});

export type ProbenmappeDeckblattPdfData = z.infer<typeof probenmappeDeckblattSchema>;

/** Deckblatt der Probenmappe (Regie): Produktion, Stand und Inhaltsverzeichnis. */
export const probenmappeDeckblattTemplate: PdfTemplate<ProbenmappeDeckblattPdfData> = {
  id: "probenmappe-deckblatt",
  label: "Probenmappe – Deckblatt",
  description: "Deckblatt mit Stand und Inhalt für die Sammel-PDF der Regie.",
  schema: probenmappeDeckblattSchema,
  documentOptions: { size: "A4", margin: PDF_MARGIN * 2, bufferPages: true },
  filename: (data) => `probenmappe-${data.generatedAt.slice(0, 10)}.pdf`,
  render: (doc, data) => {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    let y = doc.page.height * 0.22;

    textLine(doc, "Probenmappe", left, y, width, {
      font: PDF_BOLD,
      size: 30,
      color: PDF_COLOR.text,
    });
    y += 40;
    if (data.production) {
      textLine(doc, data.production, left, y, width, { size: 15, color: PDF_COLOR.muted });
      y += 24;
    }
    doc.save().rect(left, y, 48, 2).fill(PDF_COLOR.accent).restore();
    y += 14;
    textLine(
      doc,
      `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
      left,
      y,
      width,
      {
        size: 10,
        color: PDF_COLOR.muted,
      },
    );
    y += 48;

    textLine(doc, "Inhalt", left, y, width, { font: PDF_BOLD, size: 12, color: PDF_COLOR.text });
    y += 22;
    for (const part of data.parts) {
      textLine(doc, part.label, left, y, width - 60, { size: 11, color: PDF_COLOR.text });
      textLine(doc, `Seite ${part.page}`, left, y, width, {
        size: 11,
        color: PDF_COLOR.muted,
        align: "right",
      });
      y += 22;
      doc
        .save()
        .moveTo(left, y - 4)
        .lineTo(left + width, y - 4)
        .lineWidth(0.5)
        .strokeColor(PDF_COLOR.line)
        .stroke()
        .restore();
      y += 6;
    }
    if (data.missing.length) {
      y += 8;
      textLine(doc, `Noch ohne Daten: ${data.missing.join(", ")}`, left, y, width, {
        size: 9,
        color: PDF_COLOR.faint,
      });
    }
  },
};
