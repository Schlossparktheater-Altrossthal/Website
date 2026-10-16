import { z } from "zod";

import {
  PDF_COLOR,
  PDF_MARGIN,
  drawDocumentHeader,
  drawPageFooters,
  drawSectionTitle,
  drawTable,
  pdfDateTimeFormatter,
} from "../layout";
import type { PdfTemplate } from "../types";

const koerpermasseSchema = z.object({
  generatedAt: z.string().datetime(),
  production: z.string().nullable().default(null),
  measurements: z.object({
    columns: z.array(z.string()).min(1),
    /** Werte inkl. Einheit, „—“ für fehlend; gleiche Reihenfolge wie `columns`. */
    rows: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  }),
  /** null: Konfektionsgrößen nicht mitdrucken. */
  sizes: z
    .object({
      columns: z.array(z.string()).min(1),
      rows: z.array(
        z.object({
          name: z.string(),
          values: z.array(z.object({ size: z.string().nullable(), note: z.string().nullable() })),
        }),
      ),
    })
    .nullable()
    .default(null),
});

export type KoerpermassePdfData = z.infer<typeof koerpermasseSchema>;

const missing = (value: string) => value === "—" || value === "";

export const koerpermasseTemplate: PdfTemplate<KoerpermassePdfData> = {
  id: "koerpermasse",
  label: "Körpermaße & Größen",
  description: "Körpermaße und Konfektionsgrößen des Ensembles für das Kostüm-Team.",
  schema: koerpermasseSchema,
  documentOptions: { size: "A4", layout: "landscape", margin: PDF_MARGIN, bufferPages: true },
  filename: (data) => `koerpermasse-${data.generatedAt.slice(0, 10)}.pdf`,
  render: (doc, data) => {
    const { measurements, sizes } = data;
    let y = drawDocumentHeader(doc, {
      title: "Körpermaße & Größen",
      meta: [
        data.production,
        `${measurements.rows.length} Personen`,
        `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
      ],
    });

    y = drawSectionTitle(doc, "Körpermaße", y);
    y = drawTable(doc, {
      y,
      columns: [
        { label: "Person", weight: 3 },
        ...measurements.columns.map((label) => ({ label, weight: 1.4, align: "right" as const })),
      ],
      rows: measurements.rows.map((row) => ({
        cells: [
          { text: row.name, bold: true },
          ...row.values.map((value) => ({
            text: value,
            color: missing(value) ? PDF_COLOR.faint : PDF_COLOR.text,
          })),
        ],
      })),
    });

    if (sizes && sizes.rows.length) {
      y += 16;
      if (y + 60 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      y = drawSectionTitle(doc, "Konfektionsgrößen", y, "Anmerkungen klein darunter");
      drawTable(doc, {
        y,
        columns: [
          { label: "Person", weight: 3 },
          ...sizes.columns.map((label) => ({ label, weight: 2 })),
        ],
        rows: sizes.rows.map((row) => ({
          cells: [
            { text: row.name, bold: true },
            ...row.values.map((value) =>
              value.size
                ? { text: value.size, bold: true, sub: value.note }
                : { text: "—", color: PDF_COLOR.faint },
            ),
          ],
        })),
      });
    }

    drawPageFooters(
      doc,
      `Körpermaße${data.production ? ` · ${data.production}` : ""} · Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
    );
  },
};
