import ExcelJS from "exceljs";

/**
 * Leser für den Bundeslebensmittelschlüssel BLS 4.0 (Max Rubner-Institut, CC BY 4.0).
 * Download: https://www.blsdb.de/download (ZIP mit zwei Excel-Dateien).
 *
 * - `BLS_4_0_Components_DE_EN.xlsx`: Nährstoffkatalog (Code, Bezeichnung DE/EN, Einheit, Gruppe)
 * - `BLS_4_0_Daten_2025_DE.xlsx`: je Lebensmittel BLS-Code, Name DE/EN und je Nährstoff drei
 *   Spalten (Wert je 100 g, Datenherkunft, Referenz)
 */

export const BLS_ATTRIBUTION =
  "Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0, Lizenz CC BY 4.0";

export const BLS_VERSION = "4.0-2025";

export type BlsComponent = {
  code: string;
  nameDe: string;
  nameEn: string;
  unit: string;
  groupDe: string | null;
  sortOrder: number;
};

export type BlsFood = {
  code: string;
  nameDe: string;
  nameEn: string | null;
  /** Werte je 100 g; fehlende oder nicht numerische Werte fehlen im Objekt. */
  nutrients: Record<string, number>;
};

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  return String(value).trim();
}

function numeric(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
  }
  return null;
}

export async function readBlsComponents(path: string): Promise<BlsComponent[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  const components: BlsComponent[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = text(row.getCell(2).value);
    if (!code) return;
    components.push({
      code,
      nameDe: text(row.getCell(3).value),
      nameEn: text(row.getCell(4).value),
      unit: text(row.getCell(5).value),
      groupDe: text(row.getCell(6).value) || null,
      sortOrder: numeric(row.getCell(1).value) ?? rowNumber,
    });
  });
  return components;
}

/** Nährstoffcode aus einer Wertspalte („PROT625 Protein (Nx6,25) [g/100g]“), sonst `null`. */
export function blsValueColumnCode(header: string): string | null {
  const match = /^(\S+)\s.*\[[^\]]+\/100\s?g\]$/.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Liest die Lebensmittel zeilenweise (Stream): Die Datei hat über 7.000 Zeilen × 418 Spalten, das
 * komplette Arbeitsblatt im Speicher sprengt kleine Pods.
 */
export async function readBlsFoods(path: string): Promise<BlsFood[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, {
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    worksheets: "emit",
  });
  const foods: BlsFood[] = [];
  let valueColumns: { column: number; code: string }[] | null = null;

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      if (valueColumns === null) {
        const columns: { column: number; code: string }[] = [];
        row.eachCell((cell, column) => {
          const code = blsValueColumnCode(text(cell.value));
          if (code) columns.push({ column, code });
        });
        if (columns.length < 10) {
          throw new Error(
            `BLS-Datei hat unerwartete Spalten (${columns.length} Nährstoffspalten).`,
          );
        }
        valueColumns = columns;
        continue;
      }
      const code = text(row.getCell(1).value);
      if (!code) continue;
      const nutrients: Record<string, number> = {};
      for (const { column, code: nutrient } of valueColumns) {
        const value = numeric(row.getCell(column).value);
        if (value !== null) nutrients[nutrient] = value;
      }
      foods.push({
        code,
        nameDe: text(row.getCell(2).value),
        nameEn: text(row.getCell(3).value) || null,
        nutrients,
      });
    }
    break; // nur das erste Arbeitsblatt
  }
  return foods;
}
