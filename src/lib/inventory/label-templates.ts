/**
 * Etikettenbögen (A4, Maße in mm). Die Namen nennen gängige Artikelnummern nur als Beispiel –
 * entscheidend sind Etikettengröße und Raster. Für alles andere gibt es „Eigenes Format“.
 */

export type LabelSheetTemplate = {
  id: string;
  label: string;
  hint: string;
  columns: number;
  rows: number;
  /** Etikettengröße. */
  width: number;
  height: number;
  /** Abstand des ersten Etiketts vom oberen bzw. linken Blattrand. */
  marginTop: number;
  marginLeft: number;
  /** Abstand zwischen zwei Etiketten. */
  gapX: number;
  gapY: number;
};

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export const LABEL_SHEET_TEMPLATES: LabelSheetTemplate[] = [
  {
    id: "70x36",
    label: "70 × 36 mm · 24 je Bogen",
    hint: "z. B. Avery Zweckform 3475 / 3490 – guter Standard für Geräte",
    columns: 3,
    rows: 8,
    width: 70,
    height: 36,
    marginTop: 4.5,
    marginLeft: 0,
    gapX: 0,
    gapY: 0,
  },
  {
    id: "70x41",
    label: "70 × 41 mm · 21 je Bogen",
    hint: "z. B. Avery Zweckform 3481",
    columns: 3,
    rows: 7,
    width: 70,
    height: 41,
    marginTop: 5,
    marginLeft: 0,
    gapX: 0,
    gapY: 0,
  },
  {
    id: "63x38",
    label: "63,5 × 38,1 mm · 21 je Bogen",
    hint: "z. B. Avery L7160 – mit Rand, abgerundete Ecken",
    columns: 3,
    rows: 7,
    width: 63.5,
    height: 38.1,
    marginTop: 15.15,
    marginLeft: 7.2,
    gapX: 2.5,
    gapY: 0,
  },
  {
    id: "99x38",
    label: "99,1 × 38,1 mm · 14 je Bogen",
    hint: "z. B. Avery L7163 – breit, viel Platz für Text",
    columns: 2,
    rows: 7,
    width: 99.1,
    height: 38.1,
    marginTop: 15.15,
    marginLeft: 4.65,
    gapX: 2.5,
    gapY: 0,
  },
  {
    id: "38x21",
    label: "38,1 × 21,2 mm · 65 je Bogen",
    hint: "z. B. Avery L7651 – klein, für Kabel und Zubehör (nur Code)",
    columns: 5,
    rows: 13,
    width: 38.1,
    height: 21.2,
    marginTop: 10.7,
    marginLeft: 4.75,
    gapX: 2.5,
    gapY: 0,
  },
  {
    id: "105x74",
    label: "105 × 74 mm · 8 je Bogen",
    hint: "z. B. Avery Zweckform 3427 – groß, für Kisten und Regale",
    columns: 2,
    rows: 4,
    width: 105,
    height: 74,
    marginTop: 0.5,
    marginLeft: 0,
    gapX: 0,
    gapY: 0,
  },
  {
    id: "105x148",
    label: "105 × 148 mm · 4 je Bogen",
    hint: "A6 – für Lagerplätze und Regalschilder",
    columns: 2,
    rows: 2,
    width: 105,
    height: 148,
    marginTop: 0.5,
    marginLeft: 0,
    gapX: 0,
    gapY: 0,
  },
];

export const CUSTOM_TEMPLATE_ID = "custom";

export function findLabelTemplate(id: string): LabelSheetTemplate | undefined {
  return LABEL_SHEET_TEMPLATES.find((template) => template.id === id);
}

export function labelsPerSheet(template: Pick<LabelSheetTemplate, "columns" | "rows">): number {
  return template.columns * template.rows;
}

/** Passt das Raster auf ein A4-Blatt? Liefert sonst eine Fehlermeldung. */
export function validateLabelTemplate(template: LabelSheetTemplate): string | null {
  const totalWidth =
    template.marginLeft +
    template.columns * template.width +
    (template.columns - 1) * template.gapX;
  const totalHeight =
    template.marginTop + template.rows * template.height + (template.rows - 1) * template.gapY;
  if (template.columns < 1 || template.rows < 1) return "Mindestens eine Spalte und Zeile.";
  if (template.width < 15 || template.height < 10)
    return "Etiketten sind zu klein (mind. 15 × 10 mm).";
  if (totalWidth > A4_WIDTH_MM + 0.5) return "Das Raster ist breiter als ein A4-Blatt.";
  if (totalHeight > A4_HEIGHT_MM + 0.5) return "Das Raster ist höher als ein A4-Blatt.";
  return null;
}

export type LabelContentOptions = {
  showName: boolean;
  showArea: boolean;
  showInspection: boolean;
  showOrganisation: boolean;
};

export const DEFAULT_LABEL_CONTENT: LabelContentOptions = {
  showName: true,
  showArea: true,
  showInspection: true,
  showOrganisation: true,
};
