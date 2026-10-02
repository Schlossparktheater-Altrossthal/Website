/**
 * Zwischenablage für Tabellen: Tabellenkalkulationen (Excel, LibreOffice, Google Sheets)
 * kopieren Zellen als TSV – Tab zwischen Spalten, Zeilenumbruch zwischen Zeilen, Zellen mit
 * Tab/Umbruch/Anführungszeichen in "…" mit verdoppelten Anführungszeichen.
 */
export function parseClipboardTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let atCellStart = true;
  const input = text.replace(/\r\n?/g, "\n");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (char === "\t") {
      row.push(cell);
      cell = "";
      atCellStart = true;
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      atCellStart = true;
    } else {
      cell += char;
      atCellStart = false;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((entry) => entry.map((value) => value.trim()));
}

/** Gegenstück zum Einlesen: Zellen als TSV für die Zwischenablage. */
export function toClipboardTable(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => (/[\t\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
        .join("\t"),
    )
    .join("\n");
}
