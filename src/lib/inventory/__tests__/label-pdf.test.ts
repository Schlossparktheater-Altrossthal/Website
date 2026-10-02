import { describe, expect, it } from "vitest";

import { renderLabelSheetPdf } from "@/lib/inventory/label-pdf";
import {
  DEFAULT_LABEL_CONTENT,
  LABEL_SHEET_TEMPLATES,
  validateLabelTemplate,
} from "@/lib/inventory/label-templates";

const labels = Array.from({ length: 30 }, (_, index) => ({
  code: `T-${String(index + 1).padStart(4, "0")}`,
  url: `https://mitglieder.example.org/i/T-${String(index + 1).padStart(4, "0")}`,
  title: index % 2 ? "LED-Scheinwerfer PAR 64 RGBW mit sehr langem Namen" : "Kabeltrommel",
  subtitle: "Technik · Licht",
  footnote: "Prüfung bis 10.2027",
}));

describe("Etikettenbögen", () => {
  it("alle Vorlagen passen auf A4", () => {
    for (const template of LABEL_SHEET_TEMPLATES) {
      expect(validateLabelTemplate(template), template.id).toBeNull();
    }
  });

  it("meldet zu große eigene Raster", () => {
    expect(validateLabelTemplate({ ...LABEL_SHEET_TEMPLATES[0]!, columns: 4 })).toMatch(/breiter/);
  });

  it.each(LABEL_SHEET_TEMPLATES.map((template) => [template.id, template] as const))(
    "rendert %s als PDF",
    async (_id, template) => {
      const pdf = await renderLabelSheetPdf({
        labels,
        template,
        content: DEFAULT_LABEL_CONTENT,
        skip: 3,
        organisation: "Sommertheater Altrossthal",
        outlines: true,
      });
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      const pages = pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
      const perSheet = template.columns * template.rows;
      expect(pages).toBe(Math.ceil((labels.length + 3) / perSheet));
    },
  );
});
