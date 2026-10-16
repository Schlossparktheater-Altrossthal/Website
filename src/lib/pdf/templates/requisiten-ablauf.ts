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

const statusValues = ["planned", "in_progress", "ready"] as const;

const requisitenAblaufSchema = z.object({
  generatedAt: z.string().datetime(),
  production: z.string().nullable().default(null),
  scenes: z.array(
    z.object({
      title: z.string(),
      objects: z.array(
        z.object({
          title: z.string(),
          note: z.string().nullable().default(null),
          roles: z.string().nullable().default(null),
          status: z.enum(statusValues),
        }),
      ),
    }),
  ),
});

export type RequisitenAblaufPdfData = z.infer<typeof requisitenAblaufSchema>;

const STATUS = {
  planned: { text: "geplant", pill: { fill: PDF_COLOR.header, ink: PDF_COLOR.muted } },
  in_progress: { text: "in Arbeit", pill: { fill: PDF_COLOR.warningFill, ink: PDF_COLOR.warning } },
  ready: { text: "fertig", pill: { fill: PDF_COLOR.successFill, ink: PDF_COLOR.success } },
} as const;

export const requisitenAblaufTemplate: PdfTemplate<RequisitenAblaufPdfData> = {
  id: "requisiten-ablauf",
  label: "Requisiten-Ablauf",
  description: "Requisiten je Szene in Spielreihenfolge – was wird wo gebraucht, von wem.",
  schema: requisitenAblaufSchema,
  documentOptions: { size: "A4", layout: "portrait", margin: PDF_MARGIN, bufferPages: true },
  filename: (data) => `requisiten-ablauf-${data.generatedAt.slice(0, 10)}.pdf`,
  render: (doc, data) => {
    const objectCount = new Set(data.scenes.flatMap((scene) => scene.objects.map((o) => o.title)))
      .size;
    const y = drawDocumentHeader(doc, {
      title: "Requisiten-Ablauf",
      meta: [
        data.production,
        `${data.scenes.length} Szenen`,
        `${objectCount} Requisiten`,
        `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
      ],
    });

    const rows: PdfTableRow[] = data.scenes.flatMap((scene) => [
      { kind: "group" as const, label: scene.title, hint: `${scene.objects.length} Requisiten` },
      ...scene.objects.map((object) => ({
        cells: [
          { text: "", checkbox: true },
          { text: object.title, bold: true, sub: object.note },
          { text: object.roles ?? "", color: PDF_COLOR.muted },
          STATUS[object.status],
        ],
      })),
    ]);

    drawTable(doc, {
      y,
      columns: [
        { label: "", weight: 4 },
        { label: "Requisite", weight: 52 },
        { label: "Rolle", weight: 30 },
        { label: "Stand", weight: 14, align: "center" },
      ],
      rows,
    });
    drawPageFooters(
      doc,
      `Requisiten-Ablauf${data.production ? ` · ${data.production}` : ""} · Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
    );
  },
};
