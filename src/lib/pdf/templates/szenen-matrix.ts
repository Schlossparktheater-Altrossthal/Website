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

/** Mehr Szenen passen nicht lesbar auf eine Querseite; dann auf mehrere Tabellen verteilen. */
const SCENES_PER_TABLE = 24;

const szenenMatrixSchema = z.object({
  generatedAt: z.string().datetime(),
  production: z.string().nullable().default(null),
  /** Kurze Szenenkennung je Spalte, z. B. „1.3“. */
  scenes: z.array(z.object({ id: z.string(), short: z.string() })),
  roles: z.array(
    z.object({
      name: z.string(),
      /** Besetzung, z. B. „Lea / Jan“. */
      cast: z.string().nullable().default(null),
      sceneIds: z.array(z.string()),
    }),
  ),
});

export type SzenenMatrixPdfData = z.infer<typeof szenenMatrixSchema>;

export const szenenMatrixTemplate: PdfTemplate<SzenenMatrixPdfData> = {
  id: "szenen-matrix",
  label: "Szenen × Personen",
  description: "Welche Rolle (und wer) spielt in welcher Szene – Matrix für die Regie.",
  schema: szenenMatrixSchema,
  documentOptions: { size: "A4", layout: "landscape", margin: PDF_MARGIN, bufferPages: true },
  filename: (data) => `szenen-matrix-${data.generatedAt.slice(0, 10)}.pdf`,
  render: (doc, data) => {
    const stand = `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`;
    let y = drawDocumentHeader(doc, {
      title: "Szenen × Personen",
      meta: [data.production, `${data.scenes.length} Szenen`, `${data.roles.length} Rollen`, stand],
    });

    for (let start = 0; start < Math.max(data.scenes.length, 1); start += SCENES_PER_TABLE) {
      const scenes = data.scenes.slice(start, start + SCENES_PER_TABLE);
      const rows: PdfTableRow[] = data.roles.map((role) => {
        const inScenes = new Set(role.sceneIds);
        const count = scenes.filter((scene) => inScenes.has(scene.id)).length;
        return {
          cells: [
            { text: role.name, bold: true, sub: role.cast },
            ...scenes.map((scene) =>
              inScenes.has(scene.id) ? { text: "●", color: PDF_COLOR.rehearsal } : "",
            ),
            { text: String(count), color: PDF_COLOR.muted },
          ],
        };
      });
      if (start > 0) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      y = drawTable(doc, {
        y,
        columns: [
          { label: "Rolle", weight: 22 },
          ...scenes.map((scene) => ({ label: scene.short, weight: 3, align: "center" as const })),
          { label: "Σ", weight: 3, align: "center" },
        ],
        rows,
      });
    }

    drawPageFooters(
      doc,
      `Szenen × Personen${data.production ? ` · ${data.production}` : ""} · ${stand}`,
    );
  },
};
