import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

/**
 * Gemeinsame Bausteine für Listen-PDFs im Stil der Sperrliste: Kopf, Abschnittstitel,
 * mitlaufende Tabelle mit Gruppenzeilen und Fußzeile mit Seitenzahl.
 */

export const PDF_FONT = "Helvetica";
export const PDF_BOLD = "Helvetica-Bold";
export const PDF_MARGIN = 28;

export const PDF_COLOR = {
  text: "#111827",
  muted: "#6b7280",
  faint: "#9ca3af",
  line: "#e5e7eb",
  header: "#f3f4f6",
  accent: "#4f46e5",
  rehearsal: "#4338ca",
  rehearsalFill: "#e0e7ff",
  success: "#15803d",
  successFill: "#dcfce7",
  warning: "#b45309",
  warningFill: "#fef3c7",
  danger: "#b91c1c",
  dangerFill: "#fee2e2",
} as const;

type Align = "left" | "center" | "right";

export function textLine(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: { font?: string; size: number; color: string; align?: Align },
) {
  doc
    .font(options.font ?? PDF_FONT)
    .fontSize(options.size)
    .fillColor(options.color)
    .text(text, x, y, {
      width,
      height: options.size + 2,
      lineBreak: false,
      ellipsis: true,
      align: options.align ?? "left",
    });
}

/** Titel, Unterzeile und Akzentstrich. Gibt die nächste freie y-Position zurück. */
export function drawDocumentHeader(
  doc: PDFKit.PDFDocument,
  { title, meta }: { title: string; meta: (string | null | undefined | false)[] },
) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  let y = doc.page.margins.top;
  textLine(doc, title, left, y, width, { font: PDF_BOLD, size: 15, color: PDF_COLOR.text });
  y += 19;
  const subtitle = meta.filter(Boolean).join("  ·  ");
  if (subtitle) {
    textLine(doc, subtitle, left, y, width, { size: 7.5, color: PDF_COLOR.muted });
    y += 12;
  }
  doc.save().rect(left, y, 36, 1.6).fill(PDF_COLOR.accent).restore();
  return y + 10;
}

export function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number, hint?: string) {
  const left = doc.page.margins.left;
  textLine(doc, title, left, y, 300, { font: PDF_BOLD, size: 9, color: PDF_COLOR.text });
  if (hint) {
    doc.font(PDF_BOLD).fontSize(9);
    const offset = doc.widthOfString(title) + 6;
    textLine(doc, hint, left + offset, y + 1.6, 400, { size: 6.5, color: PDF_COLOR.muted });
  }
  return y + 14;
}

/** „<label> · Seite x von y“ im unteren Rand jeder Seite. Braucht `bufferPages: true`. */
export function drawPageFooters(doc: PDFKit.PDFDocument, label: string) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = doc.page.margins.bottom;
    const y = doc.page.height - bottom + 8;
    // Unterer Seitenrand darf beschrieben werden, ohne dass PDFKit umbricht.
    doc.page.margins.bottom = 0;
    textLine(doc, label, left, y, width / 1.5, { size: 6, color: PDF_COLOR.faint });
    textLine(doc, `Seite ${index - range.start + 1} von ${range.count}`, left, y, width, {
      size: 6,
      color: PDF_COLOR.faint,
      align: "right",
    });
    doc.page.margins.bottom = bottom;
  }
}

// ---------- Tabelle ----------

export type PdfTableColumn = {
  label: string;
  /** Anteil an der Tabellenbreite (wird normiert). */
  weight: number;
  align?: Align;
};

export type PdfTableCell =
  | string
  | {
      text: string;
      /** Kleine Zeilen darunter (umbrechen bei Bedarf), optional je Zeile eigene Farbe. */
      sub?: string | null | { text: string; color?: string }[];
      bold?: boolean;
      color?: string;
      subColor?: string;
      strike?: boolean;
      /** Kleine farbige Marke statt Text, z. B. Status. */
      pill?: { fill: string; ink: string } | null;
      /** Leeres Kästchen zum Abhaken auf Papier. */
      checkbox?: boolean;
    };

export type PdfTableRow =
  | {
      kind?: "row";
      cells: PdfTableCell[];
      /** Farbiger Strich am linken Rand (z. B. Probe vs. Termin). */
      accent?: string | null;
      /** Etwas Abstand davor, z. B. zwischen Wochen. */
      gapBefore?: boolean;
    }
  | { kind: "group"; label: string; hint?: string | null };

const CELL_PAD_X = 4;
const CELL_PAD_Y = 3;
const TEXT_SIZE = 7.5;
const SUB_SIZE = 6.5;
const HEADER_HEIGHT = 14;
const GROUP_HEIGHT = 15;

function normalizeCell(cell: PdfTableCell) {
  return typeof cell === "string" ? { text: cell } : cell;
}

function subLines(cell: Exclude<PdfTableCell, string>) {
  if (!cell.sub) return [];
  if (typeof cell.sub === "string") return [{ text: cell.sub, color: cell.subColor }];
  return cell.sub.filter((line) => line.text);
}

function cellHeight(doc: PDFKit.PDFDocument, cell: PdfTableCell, width: number) {
  const c = normalizeCell(cell);
  const inner = width - CELL_PAD_X * 2;
  let height = 0;
  if (c.text) {
    doc.font(c.bold ? PDF_BOLD : PDF_FONT).fontSize(TEXT_SIZE);
    height += doc.heightOfString(c.text, { width: inner });
  }
  doc.font(PDF_FONT).fontSize(SUB_SIZE);
  for (const line of subLines(c)) {
    height += 1 + doc.heightOfString(line.text, { width: inner });
  }
  return height;
}

function drawCell(
  doc: PDFKit.PDFDocument,
  cell: PdfTableCell,
  x: number,
  y: number,
  width: number,
  align: Align,
) {
  const c = normalizeCell(cell);
  const inner = width - CELL_PAD_X * 2;
  let cursor = y;
  if (c.checkbox) {
    doc
      .save()
      .lineWidth(0.7)
      .roundedRect(x + CELL_PAD_X, cursor + 0.5, 7, 7, 1.2)
      .stroke(PDF_COLOR.muted)
      .restore();
    return;
  }
  if (c.pill && c.text) {
    doc.font(PDF_BOLD).fontSize(6);
    const pillWidth = doc.widthOfString(c.text) + 8;
    const pillX =
      align === "right"
        ? x + width - CELL_PAD_X - pillWidth
        : align === "center"
          ? x + (width - pillWidth) / 2
          : x + CELL_PAD_X;
    doc.save().roundedRect(pillX, cursor, pillWidth, 9, 4.5).fill(c.pill.fill).restore();
    doc
      .fillColor(c.pill.ink)
      .text(c.text, pillX, cursor + 1.6, { width: pillWidth, align: "center", lineBreak: false });
    return;
  }
  if (c.text) {
    doc
      .font(c.bold ? PDF_BOLD : PDF_FONT)
      .fontSize(TEXT_SIZE)
      .fillColor(c.color ?? PDF_COLOR.text);
    const height = doc.heightOfString(c.text, { width: inner });
    doc.text(c.text, x + CELL_PAD_X, cursor, { width: inner, align, strike: c.strike });
    cursor += height;
  }
  doc.font(PDF_FONT).fontSize(SUB_SIZE);
  for (const line of subLines(c)) {
    const height = doc.heightOfString(line.text, { width: inner });
    doc
      .fillColor(line.color ?? PDF_COLOR.muted)
      .text(line.text, x + CELL_PAD_X, cursor + 1, { width: inner, align });
    cursor += 1 + height;
  }
}

/**
 * Zeichnet eine Tabelle ab `y` über beliebig viele Seiten; der Tabellenkopf wird auf jeder
 * neuen Seite wiederholt. Gibt die y-Position unter der Tabelle zurück.
 */
export function drawTable(
  doc: PDFKit.PDFDocument,
  { y: startY, columns, rows }: { y: number; columns: PdfTableColumn[]; rows: PdfTableRow[] },
) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const widths = columns.map((column) => (column.weight / totalWeight) * width);
  const xs = widths.map((_, index) => left + widths.slice(0, index).reduce((a, b) => a + b, 0));
  const bottom = () => doc.page.height - doc.page.margins.bottom - 6;

  const drawHeader = (top: number) => {
    doc.save().rect(left, top, width, HEADER_HEIGHT).fill(PDF_COLOR.header).restore();
    columns.forEach((column, index) => {
      textLine(doc, column.label, xs[index] + CELL_PAD_X, top + 4, widths[index] - CELL_PAD_X * 2, {
        font: PDF_BOLD,
        size: 6.5,
        color: PDF_COLOR.muted,
        align: column.align,
      });
    });
    return top + HEADER_HEIGHT;
  };

  const newPage = () => {
    doc.addPage();
    return drawHeader(doc.page.margins.top);
  };

  let y = drawHeader(startY);
  rows.forEach((row, rowIndex) => {
    if (row.kind === "group") {
      // Gruppenkopf nie allein am Seitenende stehen lassen.
      if (y + GROUP_HEIGHT + 20 > bottom()) y = newPage();
      doc
        .save()
        .rect(left, y + 2, width, GROUP_HEIGHT - 2)
        .fill("#eef2ff")
        .rect(left, y + 2, 2, GROUP_HEIGHT - 2)
        .fill(PDF_COLOR.accent)
        .restore();
      textLine(doc, row.label, left + 8, y + 6, width / 2, {
        font: PDF_BOLD,
        size: 7.5,
        color: PDF_COLOR.rehearsal,
      });
      if (row.hint) {
        textLine(doc, row.hint, left + width / 2, y + 6.5, width / 2 - 6, {
          size: 6.5,
          color: PDF_COLOR.muted,
          align: "right",
        });
      }
      y += GROUP_HEIGHT + 1;
      return;
    }

    const gap = row.gapBefore && rowIndex > 0 && rows[rowIndex - 1]?.kind !== "group" ? 4 : 0;
    const contentHeight = Math.max(
      ...row.cells.map((cell, index) => cellHeight(doc, cell, widths[index] ?? 0)),
      TEXT_SIZE + 1,
    );
    const height = contentHeight + CELL_PAD_Y * 2;
    if (y + gap + height > bottom()) {
      y = newPage();
    } else {
      y += gap;
    }
    if (row.accent) {
      doc
        .save()
        .rect(left, y + 2, 1.6, height - 4)
        .fill(row.accent)
        .restore();
    }
    row.cells.forEach((cell, index) => {
      if (index >= columns.length) return;
      drawCell(doc, cell, xs[index], y + CELL_PAD_Y, widths[index], columns[index].align ?? "left");
    });
    y += height;
    doc
      .save()
      .moveTo(left, y)
      .lineTo(left + width, y)
      .lineWidth(0.5)
      .stroke(PDF_COLOR.line)
      .restore();
  });
  return y;
}

export const pdfDateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});
