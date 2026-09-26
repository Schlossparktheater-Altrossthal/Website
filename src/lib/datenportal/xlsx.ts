import ExcelJS from "exceljs";

import { formatValue } from "./csv";
import type { FieldDefinition } from "./fields";
import type { PortalRow } from "./run";

/** Text, der in Tabellenprogrammen als Formel gelesen würde, wird als Text markiert. */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** XLSX-Datei mit einem Blatt; Zahlen und Datumswerte bleiben typisiert. */
export async function portalRowsToXlsx(
  columns: readonly FieldDefinition[],
  rows: readonly PortalRow[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Auswertung");
  sheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.max(14, column.label.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(
        columns.map((column) => {
          const value = row[column.key] ?? null;
          if (value instanceof Date || typeof value === "number") return [column.key, value];
          return [column.key, safeText(formatValue(value))];
        }),
      ),
    );
  }
  for (const column of columns) {
    if (column.type === "date") sheet.getColumn(column.key).numFmt = "dd.mm.yyyy";
  }
  return workbook.xlsx.writeBuffer();
}
