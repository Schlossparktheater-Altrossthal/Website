import { z } from "zod";

import {
  PDF_COLOR,
  PDF_MARGIN,
  drawDocumentHeader,
  drawPageFooters,
  drawTable,
  pdfDateTimeFormatter,
  type PdfTableRow,
} from "../layout";
import type { PdfTemplate } from "../types";

const eventSchema = z.object({
  /** z. B. „Fr 16.10.“ oder „Fr 16.–So 18.10.“ */
  date: z.string(),
  time: z.string().nullable(),
  title: z.string(),
  detail: z.string().nullable().default(null),
  rehearsal: z.boolean(),
  status: z.enum(["CONFIRMED", "TENTATIVE", "CANCELLED"]).default("CONFIRMED"),
  /** „fehlen: …“ bzw. „eingeschränkt: …“; null, wenn ausgeblendet oder niemand. */
  blocked: z.string().nullable().default(null),
  limited: z.string().nullable().default(null),
  /** z. B. „12/14“ */
  attendance: z.string().nullable().default(null),
});

const terminlisteSchema = z.object({
  generatedAt: z.string().datetime(),
  production: z.string().nullable().default(null),
  months: z.array(
    z.object({
      label: z.string(),
      weeks: z.array(z.array(eventSchema)),
    }),
  ),
});

export type TerminlistePdfData = z.infer<typeof terminlisteSchema>;

const STATUS_PILL = {
  TENTATIVE: { text: "vorgemerkt", pill: { fill: PDF_COLOR.warningFill, ink: PDF_COLOR.warning } },
  CANCELLED: { text: "abgesagt", pill: { fill: PDF_COLOR.dangerFill, ink: PDF_COLOR.danger } },
} as const;

export const terminlisteTemplate: PdfTemplate<TerminlistePdfData> = {
  id: "terminliste",
  label: "Terminliste",
  description: "Kompakte Liste aller Proben und Termine, nach Monat und Woche gruppiert.",
  schema: terminlisteSchema,
  documentOptions: { size: "A4", layout: "portrait", margin: PDF_MARGIN, bufferPages: true },
  filename: (data) => `termine-${data.generatedAt.slice(0, 10)}.pdf`,
  render: (doc, data) => {
    const all = data.months.flatMap((month) => month.weeks.flat());
    const rehearsals = all.filter((event) => event.rehearsal).length;
    const y = drawDocumentHeader(doc, {
      title: "Termine",
      meta: [
        data.production,
        `${rehearsals} Proben`,
        `${all.length - rehearsals} weitere Termine`,
        `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
      ],
    });

    const rows: PdfTableRow[] = [];
    for (const month of data.months) {
      const count = month.weeks.reduce((sum, week) => sum + week.length, 0);
      rows.push({ kind: "group", label: month.label, hint: `${count} Termine` });
      month.weeks.forEach((week) =>
        week.forEach((event, index) => {
          const cancelled = event.status === "CANCELLED";
          rows.push({
            gapBefore: index === 0,
            accent: event.rehearsal ? PDF_COLOR.rehearsal : PDF_COLOR.accent,
            cells: [
              { text: event.date, bold: true },
              { text: event.time ?? "", color: PDF_COLOR.muted },
              {
                text: event.title,
                bold: !event.rehearsal,
                strike: cancelled,
                color: cancelled ? PDF_COLOR.muted : PDF_COLOR.text,
                sub: [
                  { text: event.detail ?? "" },
                  { text: cancelled ? "" : (event.blocked ?? ""), color: PDF_COLOR.danger },
                  { text: cancelled ? "" : (event.limited ?? ""), color: PDF_COLOR.warning },
                ],
              },
              event.status === "CONFIRMED" ? "" : STATUS_PILL[event.status],
              { text: cancelled ? "" : (event.attendance ?? ""), color: PDF_COLOR.muted },
            ],
          });
        }),
      );
    }

    if (!rows.length) {
      doc.fontSize(9).fillColor(PDF_COLOR.muted).text("Keine Termine.", doc.page.margins.left, y);
    } else {
      drawTable(doc, {
        y,
        columns: [
          { label: "Datum", weight: 15 },
          { label: "Zeit", weight: 11 },
          { label: "Termin", weight: 56 },
          { label: "Status", weight: 10, align: "center" },
          { label: "Können", weight: 8, align: "right" },
        ],
        rows,
      });
    }
    drawPageFooters(
      doc,
      `Termine${data.production ? ` · ${data.production}` : ""} · Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
    );
  },
};
