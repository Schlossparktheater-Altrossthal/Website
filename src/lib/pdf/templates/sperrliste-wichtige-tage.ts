import { z } from "zod";

import type { PdfTemplate } from "../types";

const daySchema = z.object({
  key: z.string(),
  label: z.string(),
  title: z.string(),
});

const entrySchema = z.object({
  dayKey: z.string(),
  value: z.string().nullable(),
});

const memberSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  entries: z.array(entrySchema),
});

const sperrlisteImportantDaysSchema = z
  .object({
    generatedAt: z.string().datetime(),
    range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
      label: z.string().nullable(),
    }),
    summary: z.object({
      memberCount: z.number().int().nonnegative(),
      importantWeekdays: z.string().nullable(),
    }),
    days: z.array(daySchema),
    members: z.array(memberSchema),
  })
  .superRefine((data, ctx) => {
    data.members.forEach((member, memberIndex) => {
      if (member.entries.length !== data.days.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["members", memberIndex, "entries"],
          message: "entries length must match number of days",
        });
      }
    });
  });

export type SperrlisteImportantDaysPdfData = z.infer<typeof sperrlisteImportantDaysSchema>;

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

function ensurePageSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight <= bottom) {
    return;
  }
  doc.addPage();
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

function formatDateForFilename(value: string) {
  try {
    return value.slice(0, 10).replace(/-/g, "");
  } catch {
    return "unknown";
  }
}

function buildRangeLabel(range: SperrlisteImportantDaysPdfData["range"]) {
  try {
    const start = new Date(range.start);
    const end = new Date(range.end);
    return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
  } catch {
    return null;
  }
}

type TableCellStyle = {
  align?: "left" | "center" | "right";
  font?: "regular" | "bold";
  fontSize?: number;
  textColor?: string;
  fillColor?: string | null;
};

type TableCellConfig = {
  text: string;
  style: TableCellStyle;
};

type TableOptions = {
  headerStyles?: readonly TableCellStyle[];
  cellStyles?: readonly (readonly TableCellStyle[])[];
};

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  columnWidths: readonly number[],
  options: TableOptions = {},
) {
  if (!rows.length) {
    return;
  }

  const paddingX = 6;
  const paddingY = 4;
  const startX = doc.page.margins.left;
  const columnPositions = columnWidths.reduce<number[]>((positions, width, index) => {
    const previous = index === 0 ? startX : positions[index - 1] + columnWidths[index - 1];
    positions.push(previous);
    return positions;
  }, []);
  const totalWidth = columnWidths.reduce((sum, value) => sum + value, 0);
  const bottom = doc.page.height - doc.page.margins.bottom;

  const resolveFont = (style: TableCellStyle) => {
    if (style.font === "bold") {
      return "Helvetica-Bold";
    }
    return "Helvetica";
  };

  const resolveAlign = (style: TableCellStyle) => style.align ?? "left";

  const computeRowHeight = (cells: readonly TableCellConfig[]) => {
    return cells.reduce((max, cell, cellIndex) => {
      const font = resolveFont(cell.style);
      const fontSize = cell.style.fontSize ?? 9;
      doc.font(font).fontSize(fontSize);
      const width = Math.max(columnWidths[cellIndex] - paddingX * 2, 32);
      const align = resolveAlign(cell.style);
      const textHeight = doc.heightOfString(cell.text, {
        width,
        align,
        lineBreak: false,
      });
      const effectiveHeight = Math.max(textHeight, (cell.style.fontSize ?? 9) + 1.5);
      const height = effectiveHeight + paddingY * 2;
      return Math.max(max, height);
    }, 0);
  };

  const drawHeaderRow = () => {
    const headerCells: TableCellConfig[] = headers.map((header, index) => ({
      text: header,
      style: {
        align: index <= 1 ? "left" : "center",
        font: "bold",
        fontSize: 9,
        textColor: "#111827",
        ...(options.headerStyles?.[index] ?? {}),
      },
    }));

    const headerHeight = computeRowHeight(headerCells);
    ensurePageSpace(doc, headerHeight + 6);

    doc.save();
    doc.rect(startX, doc.y, totalWidth, headerHeight).fill("#f3f4f6");
    doc.restore();

    const rowTop = doc.y;
    headerCells.forEach((cell, index) => {
      const x = columnPositions[index] + paddingX;
      const width = Math.max(columnWidths[index] - paddingX * 2, 32);
      const font = resolveFont(cell.style);
      const fontSize = cell.style.fontSize ?? 9;
      const align = resolveAlign(cell.style);
      doc.font(font).fontSize(fontSize).fillColor(cell.style.textColor ?? "#111827");
      doc.text(cell.text, x, rowTop + paddingY, {
        width,
        align,
        lineBreak: false,
        ellipsis: true,
      });
      doc.y = rowTop;
      doc.x = startX;
    });
    doc.y += headerHeight;
    doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).strokeColor("#d1d5db").lineWidth(0.5).stroke();
  };

  const drawDataRow = (row: readonly string[], rowIndex: number) => {
    const cells: TableCellConfig[] = row.map((cell, cellIndex) => {
      const defaultStyle: TableCellStyle = {
        align: cellIndex <= 1 ? "left" : "center",
        font: cellIndex === 0 ? "bold" : "regular",
        fontSize: 9,
        textColor: cellIndex === 1 ? "#4b5563" : "#1f2937",
      };
      const style = { ...defaultStyle, ...(options.cellStyles?.[rowIndex]?.[cellIndex] ?? {}) } satisfies TableCellStyle;
      return { text: cell, style };
    });

    const rowHeight = computeRowHeight(cells);
    if (doc.y + rowHeight > bottom) {
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
      drawHeaderRow();
    }

    if (rowIndex % 2 === 1) {
      doc.save();
      doc.rect(startX, doc.y, totalWidth, rowHeight).fill("#f9fafb");
      doc.restore();
    }

    const rowTop = doc.y;
    cells.forEach((cell, cellIndex) => {
      const x = columnPositions[cellIndex];
      const width = Math.max(columnWidths[cellIndex], 32);
      const textWidth = Math.max(width - paddingX * 2, 32);
      const align = resolveAlign(cell.style);
      const font = resolveFont(cell.style);
      const fontSize = cell.style.fontSize ?? 9;
      const textColor = cell.style.textColor ?? "#1f2937";

      if (cell.style.fillColor) {
        doc.save();
        doc.rect(x, doc.y, width, rowHeight).fill(cell.style.fillColor);
        doc.restore();
      }

      doc
        .font(font)
        .fontSize(fontSize)
        .fillColor(textColor)
        .text(cell.text, x + paddingX, rowTop + paddingY, {
          width: textWidth,
          align,
          lineBreak: false,
          ellipsis: true,
        });
      doc.y = rowTop;
      doc.x = startX;
    });

    doc.y += rowHeight;
    doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  };

  drawHeaderRow();
  rows.forEach((row, index) => {
    drawDataRow(row, index);
  });
  doc.moveDown(0.6);
}

export const sperrlisteImportantDaysTemplate: PdfTemplate<SperrlisteImportantDaysPdfData> = {
  id: "sperrliste-wichtige-tage",
  label: "Sperrliste · Wichtige Probentage",
  description:
    "Zeigt Sperrtermine der wichtigsten Probentage im Zwei-Wochen-Fenster als kompakt formatiertes Tabellen-PDF.",
  filename: (data) => {
    const start = formatDateForFilename(data.range.start);
    const end = formatDateForFilename(data.range.end);
    return `sperrliste-wichtige-tage-${start}-${end}.pdf`;
  },
  async render(doc, data) {
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Sperrliste · Wichtige Probentage");

    const accentStartX = doc.page.margins.left;
    const accentEndX = accentStartX + 64;
    const accentY = doc.y + 6;
    doc
      .moveTo(accentStartX, accentY)
      .lineTo(accentEndX, accentY)
      .strokeColor("#4f46e5")
      .lineWidth(2)
      .stroke();
    doc.moveDown(0.9);

    const generatedAt = new Date(data.generatedAt);
    const effectiveRangeLabel = data.range.label ?? buildRangeLabel(data.range) ?? "–";
    const metadataItems = [
      `Zeitraum: ${effectiveRangeLabel}`,
      `Generiert: ${dateTimeFormatter.format(generatedAt)}`,
      data.summary.importantWeekdays
        ? `Berücksichtigte Tage: ${data.summary.importantWeekdays}`
        : null,
      `Mitglieder mit Sperrterminen: ${data.summary.memberCount}`,
    ].filter((value): value is string => Boolean(value));

    const summaryBoxX = doc.page.margins.left;
    const summaryBoxY = doc.y;
    const summaryBoxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const summaryBoxPaddingX = 14;
    const summaryBoxPaddingY = 12;
    const summaryTextWidth = Math.max(summaryBoxWidth - summaryBoxPaddingX * 2, 120);

    const summaryText = metadataItems.join("   •   ");
    doc.font("Helvetica").fontSize(10);
    const summaryTextHeight = doc.heightOfString(summaryText, {
      width: summaryTextWidth,
      align: "left",
      lineGap: 2,
      lineBreak: false,
    });
    const summaryBoxHeight = summaryTextHeight + summaryBoxPaddingY * 2;

    doc
      .save()
      .rect(summaryBoxX, summaryBoxY, summaryBoxWidth, summaryBoxHeight)
      .fill("#f9fafb")
      .restore();

    doc
      .fillColor("#1f2937")
      .text(summaryText, summaryBoxX + summaryBoxPaddingX, summaryBoxY + summaryBoxPaddingY, {
        width: summaryTextWidth,
        lineGap: 2,
        lineBreak: false,
        ellipsis: true,
      });

    doc.y = summaryBoxY + summaryBoxHeight + 12;

    if (!data.days.length || !data.members.length || data.summary.memberCount === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#4b5563")
        .text("Für den angegebenen Zeitraum liegen keine Sperrtermine auf wichtigen Tagen vor.");
      return;
    }

    const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const dayCount = data.days.length;
    const minNameWidth = 120;
    const minEmailWidth = 120;
    const minDayWidth = 56;
    const absoluteMinNameWidth = 90;
    const absoluteMinEmailWidth = 90;
    const absoluteMinDayWidth = 36;

    let nameWidth = minNameWidth;
    let emailWidth = minEmailWidth;
    let dayWidth = minDayWidth;

    const minimalTotal = nameWidth + emailWidth + dayWidth * dayCount;
    if (minimalTotal > availableWidth) {
      const excess = minimalTotal - availableWidth;
      const adjustableName = Math.max(0, nameWidth - absoluteMinNameWidth);
      const adjustableEmail = Math.max(0, emailWidth - absoluteMinEmailWidth);
      const adjustableDay = Math.max(0, dayWidth - absoluteMinDayWidth) * dayCount;
      const adjustableTotal = adjustableName + adjustableEmail + adjustableDay;

      if (adjustableTotal > 0) {
        const ratio = Math.min(1, excess / adjustableTotal);
        nameWidth -= adjustableName * ratio;
        emailWidth -= adjustableEmail * ratio;
        dayWidth -= Math.max(0, dayWidth - absoluteMinDayWidth) * ratio;
      }

      const adjustedTotal = nameWidth + emailWidth + dayWidth * dayCount;
      if (adjustedTotal > availableWidth && adjustedTotal > 0) {
        const scale = availableWidth / adjustedTotal;
        nameWidth *= scale;
        emailWidth *= scale;
        dayWidth *= scale;
      }
    } else {
      const extra = availableWidth - minimalTotal;
      const weightName = 1.2;
      const weightEmail = 1.1;
      const weightDay = dayCount > 0 ? 0.9 * dayCount : 0;
      const weightSum = weightName + weightEmail + weightDay;
      if (weightSum > 0) {
        nameWidth += (weightName / weightSum) * extra;
        emailWidth += (weightEmail / weightSum) * extra;
        if (dayCount > 0) {
          dayWidth += ((weightDay / weightSum) * extra) / dayCount;
        }
      }
    }

    nameWidth = Math.max(0, nameWidth);
    emailWidth = Math.max(0, emailWidth);
    dayWidth = Math.max(0, dayWidth);

    const columnWidths = [nameWidth, emailWidth, ...Array(dayCount).fill(dayWidth)];

    const headers: string[] = ["Mitglied", "E-Mail", ...data.days.map((day) => day.label)];
    const dayLookup = new Map(data.days.map((day, index) => [day.key, index] as const));

    const rows = data.members.map((member) => {
      const cells = Array<string>(dayCount).fill("–");
      const styles: TableCellStyle[] = Array.from({ length: dayCount }, () => ({
        align: "center",
        textColor: "#9ca3af",
      }));

      member.entries.forEach((entry, entryIndex) => {
        const columnIndex = dayLookup.get(entry.dayKey) ?? entryIndex;
        if (columnIndex >= dayCount) {
          return;
        }

        if (!entry.value || !entry.value.trim()) {
          cells[columnIndex] = "✓";
          styles[columnIndex] = {
            align: "center",
            font: "bold",
            textColor: "#1e3a8a",
            fillColor: "#eef2ff",
          };
          return;
        }

        const trimmed = entry.value.replace(/\s+/g, " ").trim();
        const isGeneric = trimmed.toLowerCase() === "gesperrt";
        const truncated = trimmed.length > 60 ? `${trimmed.slice(0, 57).trimEnd()}…` : trimmed;
        cells[columnIndex] = isGeneric ? "✓" : `✓ ${truncated}`;
        styles[columnIndex] = {
          align: "center",
          font: isGeneric ? "bold" : "regular",
          fontSize: isGeneric ? 10 : 8.5,
          textColor: "#1e3a8a",
          fillColor: "#eef2ff",
        };
      });

      const nameCellStyle: TableCellStyle = { font: "bold", textColor: "#111827" };
      const emailCellStyle: TableCellStyle = {
        textColor: member.email ? "#4b5563" : "#9ca3af",
      };

      return {
        values: [member.name, member.email?.trim() || "–", ...cells] as const,
        styles: [nameCellStyle, emailCellStyle, ...styles],
      };
    });

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Sperrtermine im Überblick");
    doc.moveDown(0.4);

    drawTable(
      doc,
      headers,
      rows.map((row) => row.values),
      columnWidths,
      {
        headerStyles: headers.map((_, index) => ({ align: index <= 1 ? "left" : "center" })),
        cellStyles: rows.map((row) => row.styles),
      },
    );

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(
        "Hinweis: ✓ markiert Sperrtage. Angegebene Gründe werden neben dem Häkchen angezeigt; leere Felder bedeuten keine Sperre am jeweiligen Tag.",
      );
  },
  schema: sperrlisteImportantDaysSchema,
};
