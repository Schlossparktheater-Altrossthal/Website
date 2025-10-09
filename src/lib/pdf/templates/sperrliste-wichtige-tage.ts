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

type TableCellIcon = {
  type: "check" | "cross";
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
  offsetY?: number;
  spacing?: number;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
};

type TableCellStyle = {
  align?: "left" | "center" | "right";
  font?: "regular" | "bold";
  fontSize?: number;
  textColor?: string;
  fillColor?: string | null;
  prefixIcon?: TableCellIcon | null;
  secondaryText?: string | null;
  secondaryFont?: "regular" | "bold";
  secondaryFontSize?: number;
  secondaryTextColor?: string;
  secondarySpacing?: number;
  contentOffsetY?: number;
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

  const paddingX = 5;
  const paddingY = 3;
  const startX = doc.page.margins.left;
  const columnPositions = columnWidths.reduce<number[]>((positions, width, index) => {
    const previous = index === 0 ? startX : positions[index - 1] + columnWidths[index - 1];
    positions.push(previous);
    return positions;
  }, []);
  const totalWidth = columnWidths.reduce((sum, value) => sum + value, 0);
  const bottom = doc.page.height - doc.page.margins.bottom;

  const columnBoundaries = columnPositions.map((position, index) => position + columnWidths[index]);
  const gridLinesX = [startX, ...columnBoundaries];
  const gridColor = "#9ca3af";
  const gridWidth = 0.75;

  const drawGridLines = (top: number, bottom: number, includeTop: boolean) => {
    doc.save().lineWidth(gridWidth).strokeColor(gridColor);
    if (includeTop) {
      doc.moveTo(startX, top).lineTo(startX + totalWidth, top).stroke();
    }
    doc.moveTo(startX, bottom).lineTo(startX + totalWidth, bottom).stroke();
    gridLinesX.forEach((x) => {
      doc.moveTo(x, top).lineTo(x, bottom).stroke();
    });
    doc.restore();
  };

  const resolveFont = (style: TableCellStyle) => {
    if (style.font === "bold") {
      return "Helvetica-Bold";
    }
    return "Helvetica";
  };

  const resolveAlign = (style: TableCellStyle) => style.align ?? "left";

  const measurePrefixIconWidth = (
    icon: TableCellIcon | null | undefined,
    hasText: boolean,
  ): number => {
    if (!icon) {
      return 0;
    }
    const align = icon.align ?? "left";
    if (align !== "left" || !hasText) {
      return 0;
    }
    return (icon.size ?? 9) + (icon.spacing ?? 4);
  };

  const computeRowHeight = (cells: readonly TableCellConfig[]) => {
    return cells.reduce((max, cell, cellIndex) => {
      const font = resolveFont(cell.style);
      const fontSize = cell.style.fontSize ?? 9;
      const icon = cell.style.prefixIcon;
      const text = cell.text?.trim() ?? "";
      const iconWidth = measurePrefixIconWidth(icon, text.length > 0);
      const width = Math.max(columnWidths[cellIndex] - paddingX * 2 - iconWidth, 16);
      const align = resolveAlign(cell.style);
      doc.font(font).fontSize(fontSize);
      const primaryHeight = text
        ? doc.heightOfString(text, {
            width,
            align,
            lineBreak: false,
          })
        : 0;
      const secondaryText = cell.style.secondaryText?.trim() ?? "";
      const secondaryFont = resolveFont({ font: cell.style.secondaryFont ?? "regular" });
      const secondaryFontSize = cell.style.secondaryFontSize ?? Math.max(fontSize - 1.5, 6.5);
      doc.font(secondaryFont).fontSize(secondaryFontSize);
      const secondaryHeight = secondaryText
        ? doc.heightOfString(secondaryText, {
            width,
            align,
            lineBreak: false,
          })
        : 0;
      const spacing = secondaryHeight > 0 && primaryHeight > 0 ? cell.style.secondarySpacing ?? 1.6 : 0;
      const textHeight = primaryHeight + spacing + secondaryHeight;
      const iconHeight = icon?.size ?? 0;
      const contentOffsetY = cell.style.contentOffsetY ?? 0;
      const fallbackHeight =
        (cell.style.fontSize ?? 9) +
        1.5 +
        (secondaryHeight > 0 ? (cell.style.secondaryFontSize ?? Math.max(fontSize - 1.5, 6.5)) : 0);
      const effectiveHeight = Math.max(textHeight + contentOffsetY, iconHeight, fallbackHeight + contentOffsetY);
      const height = effectiveHeight + paddingY * 2;
      return Math.max(max, height);
    }, 0);
  };

  const drawPrefixIcon = (
    icon: TableCellIcon,
    cellX: number,
    columnWidth: number,
    rowTop: number,
    rowHeight: number,
    textColor: string,
    hasText: boolean,
  ) => {
    const size = icon.size ?? 9;
    const strokeWidth = icon.strokeWidth ?? Math.max(1, size / 5.5);
    const align = icon.align ?? "left";
    const iconAreaWidth = Math.max(columnWidth - paddingX * 2, size);
    let iconX = cellX + paddingX;
    if (align === "center") {
      iconX = cellX + paddingX + Math.max((iconAreaWidth - size) / 2, 0);
    }
    if (align === "right") {
      iconX = cellX + paddingX + Math.max(iconAreaWidth - size, 0);
    }
    if (align === "left" && !hasText) {
      const offset = Math.max((iconAreaWidth - size) / 2, 0);
      iconX = cellX + paddingX + offset;
    }

    const verticalAlign = icon.verticalAlign ?? "middle";
    let iconY = rowTop + paddingY + (rowHeight - paddingY * 2 - size) / 2;
    if (verticalAlign === "top") {
      iconY = rowTop + paddingY;
    }
    if (verticalAlign === "bottom") {
      iconY = rowTop + rowHeight - paddingY - size;
    }
    iconY += icon.offsetY ?? 0;
    const strokeColor = icon.strokeColor ?? textColor;

    if (icon.type === "check") {
      doc
        .save()
        .lineWidth(strokeWidth)
        .strokeColor(strokeColor)
        .moveTo(iconX, iconY + size * 0.6)
        .lineTo(iconX + size * 0.35, iconY + size * 0.9)
        .lineTo(iconX + size, iconY + size * 0.1)
        .stroke()
        .restore();
      return;
    }

    if (icon.type === "cross") {
      const inset = Math.max(size * 0.1, strokeWidth / 2);
      const startX = iconX + inset;
      const startY = iconY + inset;
      const endX = iconX + size - inset;
      const endY = iconY + size - inset;

      doc
        .save()
        .lineWidth(strokeWidth)
        .strokeColor(strokeColor)
        .moveTo(startX, startY)
        .lineTo(endX, endY)
        .moveTo(endX, startY)
        .lineTo(startX, endY)
        .stroke()
        .restore();
    }
  };

  const drawHeaderRow = () => {
    const headerCells: TableCellConfig[] = headers.map((header, index) => ({
      text: header,
      style: {
        align: index === 0 ? "left" : "center",
        font: "bold",
        fontSize: 8,
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
      const fontSize = cell.style.fontSize ?? 8.5;
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
    drawGridLines(rowTop, doc.y, true);
  };

  const drawDataRow = (row: readonly string[], rowIndex: number) => {
    const cells: TableCellConfig[] = row.map((cell, cellIndex) => {
      const defaultStyle: TableCellStyle = {
        align: cellIndex === 0 ? "left" : "center",
        font: cellIndex === 0 ? "bold" : "regular",
        fontSize: cellIndex === 0 ? 8 : 7.4,
        textColor: cellIndex === 0 ? "#111827" : "#1f2937",
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
      const icon = cell.style.prefixIcon;
      const textColor = cell.style.textColor ?? "#1f2937";
      const text = cell.text?.trim() ?? "";
      const iconWidth = measurePrefixIconWidth(icon, text.length > 0);
      const textWidth = Math.max(width - paddingX * 2 - iconWidth, 16);
      const align = resolveAlign(cell.style);
      const font = resolveFont(cell.style);
      const fontSize = cell.style.fontSize ?? 9;
      const secondaryText = cell.style.secondaryText?.trim() ?? "";
      const secondaryFont = resolveFont({ font: cell.style.secondaryFont ?? "regular" });
      const secondaryFontSize = cell.style.secondaryFontSize ?? Math.max(fontSize - 1.5, 6.5);
      const spacing = secondaryText && text ? cell.style.secondarySpacing ?? 1.6 : 0;

      if (cell.style.fillColor) {
        doc.save();
        doc.rect(x, doc.y, width, rowHeight).fill(cell.style.fillColor);
        doc.restore();
      }

      if (icon) {
        drawPrefixIcon(icon, x, width, rowTop, rowHeight, textColor, text.length > 0);
      }

      doc.font(font).fontSize(fontSize);
      const primaryHeight = text
        ? doc.heightOfString(text, {
            width: textWidth,
            align,
            lineBreak: false,
          })
        : 0;
      const contentOffsetY = cell.style.contentOffsetY ?? 0;
      const textStartY = rowTop + paddingY + contentOffsetY;

      if (text) {
        doc
          .font(font)
          .fontSize(fontSize)
          .fillColor(textColor)
          .text(text, x + paddingX + iconWidth, textStartY, {
            width: textWidth,
            align,
            lineBreak: false,
            ellipsis: true,
          });
      }

      if (secondaryText) {
        doc
          .font(secondaryFont)
          .fontSize(secondaryFontSize)
          .fillColor(cell.style.secondaryTextColor ?? textColor)
          .text(secondaryText, x + paddingX + iconWidth, textStartY + primaryHeight + spacing, {
            width: textWidth,
            align,
            lineBreak: false,
            ellipsis: true,
          });
      }
      doc.y = rowTop;
      doc.x = startX;
    });

    doc.y += rowHeight;
    drawGridLines(rowTop, doc.y, false);
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
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#111827").text("Sperrliste · Wichtige Probentage");

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
    const summaryBoxPaddingX = 12;
    const summaryBoxPaddingY = 10;
    const summaryTextWidth = Math.max(summaryBoxWidth - summaryBoxPaddingX * 2, 120);

    const summaryText = metadataItems.join(" • ");
    doc.font("Helvetica").fontSize(8.5);
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

    doc.y = summaryBoxY + summaryBoxHeight + 10;

    if (!data.days.length || !data.members.length || data.summary.memberCount === 0) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#4b5563")
        .text("Für den angegebenen Zeitraum liegen keine Sperrtermine auf wichtigen Tagen vor.");
      return;
    }

    const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const dayCount = data.days.length;
    const minNameWidth = 136;
    const minDayWidth = 48;
    const absoluteMinNameWidth = 100;
    const absoluteMinDayWidth = 32;

    let nameWidth = minNameWidth;
    let dayWidth = minDayWidth;

    const minimalTotal = nameWidth + dayWidth * dayCount;
    if (minimalTotal > availableWidth) {
      const excess = minimalTotal - availableWidth;
      const adjustableName = Math.max(0, nameWidth - absoluteMinNameWidth);
      const adjustableDay = Math.max(0, dayWidth - absoluteMinDayWidth) * dayCount;
      const adjustableTotal = adjustableName + adjustableDay;

      if (adjustableTotal > 0) {
        const ratio = Math.min(1, excess / adjustableTotal);
        nameWidth -= adjustableName * ratio;
        dayWidth -= Math.max(0, dayWidth - absoluteMinDayWidth) * ratio;
      }

      const adjustedTotal = nameWidth + dayWidth * dayCount;
      if (adjustedTotal > availableWidth && adjustedTotal > 0) {
        const scale = availableWidth / adjustedTotal;
        nameWidth *= scale;
        dayWidth *= scale;
      }
    } else {
      const extra = availableWidth - minimalTotal;
      const weightName = 1.35;
      const weightDay = dayCount > 0 ? 0.85 * dayCount : 0;
      const weightSum = weightName + weightDay;
      if (weightSum > 0) {
        nameWidth += (weightName / weightSum) * extra;
        if (dayCount > 0) {
          dayWidth += ((weightDay / weightSum) * extra) / dayCount;
        }
      }
    }

    nameWidth = Math.max(0, nameWidth);
    dayWidth = Math.max(0, dayWidth);

    const columnWidths = [nameWidth, ...Array(dayCount).fill(dayWidth)];

    const headers: string[] = ["Mitglied", ...data.days.map((day) => day.label)];
    const dayLookup = new Map(data.days.map((day, index) => [day.key, index] as const));

    const rows = data.members.map((member) => {
      const cells = Array<string>(dayCount).fill("–");
      const styles: TableCellStyle[] = Array.from({ length: dayCount }, () => ({
        align: "center",
        fontSize: 7.2,
        textColor: "#9ca3af",
        prefixIcon: null,
      }));

      member.entries.forEach((entry, entryIndex) => {
        const columnIndex = dayLookup.get(entry.dayKey) ?? entryIndex;
        if (columnIndex >= dayCount) {
          return;
        }

        const normalized = entry.value?.replace(/\s+/g, " ").trim();
        if (!normalized) {
          return;
        }

        const lower = normalized.toLowerCase();
        if (lower === "frei" || lower === "verfügbar") {
          return;
        }

        const isGeneric = lower === "gesperrt";
        const truncated = normalized.length > 60 ? `${normalized.slice(0, 57).trimEnd()}…` : normalized;
        const iconSize = 10;
        if (isGeneric) {
          cells[columnIndex] = "";
          styles[columnIndex] = {
            align: "center",
            font: "bold",
            fontSize: 7.5,
            textColor: "#7f1d1d",
            fillColor: "#fee2e2",
            prefixIcon: {
              type: "cross",
              size: iconSize,
              strokeColor: "#b91c1c",
              align: "center",
            },
          };
          return;
        }

        cells[columnIndex] = "Notiz";
        styles[columnIndex] = {
          align: "center",
          font: "bold",
          fontSize: 7.2,
          textColor: "#7f1d1d",
          fillColor: "#fef2f2",
          prefixIcon: {
            type: "cross",
            size: iconSize,
            strokeColor: "#b91c1c",
            align: "center",
            verticalAlign: "top",
          },
          contentOffsetY: iconSize + 3,
          secondaryText: truncated,
          secondaryFont: "regular",
          secondaryFontSize: 6.3,
          secondaryTextColor: "#991b1b",
          secondarySpacing: 2,
        };
      });

      const trimmedEmail = member.email?.trim() ?? "";
      const nameCellStyle: TableCellStyle = {
        font: "bold",
        fontSize: 8.5,
        textColor: "#111827",
        secondaryText: trimmedEmail || null,
        secondaryFont: "regular",
        secondaryFontSize: trimmedEmail ? 6.4 : undefined,
        secondaryTextColor: trimmedEmail ? "#6b7280" : undefined,
        secondarySpacing: trimmedEmail ? 1.2 : undefined,
      };

      return {
        values: [member.name, ...cells] as const,
        styles: [nameCellStyle, ...styles],
      };
    });

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Sperrtermine im Überblick");
    doc.moveDown(0.4);

    drawTable(
      doc,
      headers,
      rows.map((row) => row.values),
      columnWidths,
      {
        headerStyles: headers.map((_, index) => ({ align: index === 0 ? "left" : "center" })),
        cellStyles: rows.map((row) => row.styles),
      },
    );

    doc
      .font("Helvetica")
      .fontSize(7.4)
      .fillColor("#6b7280")
      .text(
        "Hinweis: Kreuze markieren Sperrtage. Angegebene Gründe werden neben dem Symbol angezeigt; leere Felder bedeuten keine Sperre am jeweiligen Tag.",
      );
  },
  schema: sperrlisteImportantDaysSchema,
};
