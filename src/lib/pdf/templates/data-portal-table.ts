import { z } from "zod";

import type { PdfTemplate } from "../types";

const dataPortalTableSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().nullable(),
  generatedAt: z.date(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
});

type DataPortalTableData = z.infer<typeof dataPortalTableSchema>;

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

const CELL_PADDING = 5;

export const dataPortalTableTemplate: PdfTemplate<DataPortalTableData> = {
  id: "data-portal-table",
  label: "Datenportal-Auswertung",
  description: "Tabellarische Auswertung aus dem Datenportal (Querformat, Kopfzeile je Seite).",
  filename: () => "datenportal-auswertung.pdf",
  schema: dataPortalTableSchema,
  documentOptions: { size: "A4", layout: "landscape", margin: 40, bufferPages: false },
  render(doc, data) {
    doc.info.Title = data.title;
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text(data.title);
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
    if (data.subtitle) doc.text(data.subtitle);
    doc.text(
      `Exportiert: ${formatDateTime(data.generatedAt)} · ${data.rows.length} Zeilen · vertraulich, nach Gebrauch löschen`,
    );
    doc.moveDown(0.8);

    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = width / data.columns.length;
    const textWidth = columnWidth - CELL_PADDING * 2;
    const bottom = () => doc.page.height - doc.page.margins.bottom;

    const drawRow = (cells: readonly string[], header: boolean) => {
      doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      const height =
        Math.max(...cells.map((cell) => doc.heightOfString(cell || " ", { width: textWidth }))) +
        CELL_PADDING * 2;
      if (doc.y + height > bottom()) {
        doc.addPage();
        drawRow(data.columns, true);
        doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      }
      const y = doc.y;
      if (header) doc.save().rect(x, y, width, height).fill("#f3f4f6").restore();
      doc.fillColor("#111827");
      cells.forEach((cell, index) => {
        doc.text(cell, x + index * columnWidth + CELL_PADDING, y + CELL_PADDING, {
          width: textWidth,
        });
      });
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .moveTo(x, y + height)
        .lineTo(x + width, y + height)
        .stroke();
      doc.y = y + height;
      doc.x = x;
    };

    drawRow(data.columns, true);
    for (const row of data.rows) drawRow(row, false);
  },
};
