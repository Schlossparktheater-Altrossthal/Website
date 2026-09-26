import type { FieldDefinition, FieldValue } from "./fields";
import type { PortalRow } from "./run";

export function formatValue(value: FieldValue): string {
  if (value === null) return "";
  if (value instanceof Date)
    return value.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  if (typeof value === "boolean") return value ? "ja" : "nein";
  return String(value);
}

function csvCell(value: string): string {
  // Formeln in Tabellenprogrammen verhindern (CSV-Injection).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV für Excel/LibreOffice (Semikolon, UTF-8 mit BOM). */
export function portalRowsToCsv(columns: readonly FieldDefinition[], rows: readonly PortalRow[]) {
  const header = columns.map((column) => csvCell(column.label)).join(";");
  const lines = rows.map((row) =>
    columns.map((column) => csvCell(formatValue(row[column.key] ?? null))).join(";"),
  );
  return `﻿${[header, ...lines].join("\r\n")}\r\n`;
}
