import { z } from "zod";

import type { PdfTemplate } from "../types";

const daySchema = z.object({
  key: z.string(),
  label: z.string(),
  title: z.string(),
});

const entryStatusValues = ["none", "blocked", "limited", "preferred"] as const;
const entryStatusSchema = z.enum(entryStatusValues);

const entrySchema = z.object({
  dayKey: z.string(),
  status: entryStatusSchema,
  value: z.string().nullable(),
});

const memberZoneValues = ["acting", "crew", "both", "unknown"] as const;
const memberZoneSchema = z.enum(memberZoneValues);

const memberSchema = z.object({
  zone: memberZoneSchema,
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
type MemberZone = (typeof memberZoneValues)[number];
type MemberEntryStatus = (typeof entryStatusValues)[number];

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
  lineBreak?: boolean;
  lineGap?: number;
  verticalAlign?: "top" | "middle" | "bottom";
  rotate?: number;
  affectsRowHeight?: boolean;
};

type TableCellConfig = {
  text: string;
  style: TableCellStyle;
};

type TableOptions = {
  headerStyles?: readonly TableCellStyle[];
  cellStyles?: readonly (readonly TableCellStyle[])[];
  rowBackgrounds?: readonly (string | null | undefined)[];
  repeatHeaderAtBottom?: boolean;
  mergedColumnGroups?: readonly TableMergedColumnGroup[];
};

type TableMergedColumnGroup = {
  columnIndex: number;
  groups: readonly {
    startRow: number;
    rowSpan: number;
    text: string;
    style?: TableCellStyle;
  }[];
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
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  const columnBoundaries = columnPositions.map((position, index) => position + columnWidths[index]);
  const gridLinesX = [startX, ...columnBoundaries];
  const horizontalSegments = columnPositions.map((position, index) => ({
    start: position,
    end: columnBoundaries[index],
    columnIndex: index,
  }));
  const gridColor = "#9ca3af";
  const gridWidth = 0.75;

  const mergedColumnGroups = options.mergedColumnGroups ?? [];
  type MergedCellInfo = {
    columnIndex: number;
    group: (typeof mergedColumnGroups)[number]["groups"][number];
  };
  const mergedCellLookup = new Map<string, MergedCellInfo>();
  const skipHorizontalBoundaries = new Set<string>();

  mergedColumnGroups.forEach((columnGroup) => {
    columnGroup.groups.forEach((group) => {
      for (let offset = 0; offset < group.rowSpan; offset += 1) {
        const rowIndex = group.startRow + offset;
        const key = `${rowIndex}:${columnGroup.columnIndex}`;
        mergedCellLookup.set(key, { columnIndex: columnGroup.columnIndex, group });
        if (offset < group.rowSpan - 1) {
          skipHorizontalBoundaries.add(`${columnGroup.columnIndex}:${rowIndex}`);
        }
      }
    });
  });

  const rowMetrics: { top: number; height: number }[] = [];

  const drawHorizontalLine = (y: number, boundaryRowIndex: number | null) => {
    horizontalSegments.forEach(({ start, end, columnIndex }) => {
      if (boundaryRowIndex !== null) {
        const key = `${columnIndex}:${boundaryRowIndex}`;
        if (skipHorizontalBoundaries.has(key)) {
          return;
        }
      }
      doc.moveTo(start, y).lineTo(end, y).stroke();
    });
  };

  const drawGridLines = (top: number, bottom: number, includeTop: boolean, boundaryRowIndex: number | null) => {
    doc.save().lineWidth(gridWidth).strokeColor(gridColor);
    if (includeTop) {
      drawHorizontalLine(top, null);
    }
    drawHorizontalLine(bottom, boundaryRowIndex);
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
      if (cell.style.affectsRowHeight === false) {
        return max;
      }
      const font = resolveFont(cell.style);
      const fontSize = cell.style.fontSize ?? 9;
      const icon = cell.style.prefixIcon;
      const text = cell.text?.trim() ?? "";
      const iconWidth = measurePrefixIconWidth(icon, text.length > 0);
      const width = Math.max(columnWidths[cellIndex] - paddingX * 2 - iconWidth, 16);
      const align = resolveAlign(cell.style);
      const lineBreak = cell.style.lineBreak ?? false;
      const lineGap = cell.style.lineGap;
      doc.font(font).fontSize(fontSize);
      const primaryHeight = text
        ? doc.heightOfString(text, {
            width,
            align,
            lineBreak,
            lineGap,
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

  const headerCells: TableCellConfig[] = headers.map((header, index) => ({
    text: header,
    style: {
      align: "center",
      font: "bold",
      fontSize: 8,
      textColor: "#111827",
      verticalAlign: "middle",
      ...(options.headerStyles?.[index] ?? {}),
    },
  }));
  const headerHeight = computeRowHeight(headerCells);
  const tableBottom = Math.max(
    options.repeatHeaderAtBottom ? pageBottom - headerHeight : pageBottom,
    doc.page.margins.top,
  );

  const renderHeaderRowAt = (y: number, includeTopBorder: boolean) => {
    doc.save();
    doc.rect(startX, y, totalWidth, headerHeight).fill("#f3f4f6");
    doc.restore();

    headerCells.forEach((cell, index) => {
      const columnX = columnPositions[index];
      const columnWidth = Math.max(columnWidths[index], 32);
      const align = resolveAlign(cell.style);
      const useFullWidth = align === "center";
      const availableWidth = useFullWidth ? columnWidth : Math.max(columnWidth - paddingX * 2, 16);
      const font = resolveFont(cell.style);
      const fontSize = cell.style.fontSize ?? 8.5;
      const lineBreak = cell.style.lineBreak ?? false;
      const lineGap = cell.style.lineGap;
      const verticalAlign = cell.style.verticalAlign ?? "middle";
      const textColor = cell.style.textColor ?? "#111827";

      doc.font(font).fontSize(fontSize);
      const textHeight = doc.heightOfString(cell.text, {
        width: availableWidth,
        align,
        lineBreak,
        lineGap,
      });

      const offsetX = useFullWidth ? 0 : paddingX;
      const basePaddingY = useFullWidth ? 0 : paddingY;
      const extraVerticalSpace = Math.max(headerHeight - textHeight - basePaddingY * 2, 0);
      let offsetY = basePaddingY;
      if (verticalAlign === "middle") {
        offsetY = basePaddingY + extraVerticalSpace / 2;
      } else if (verticalAlign === "bottom") {
        offsetY = basePaddingY + extraVerticalSpace;
      }

      doc
        .font(font)
        .fontSize(fontSize)
        .fillColor(textColor)
        .text(cell.text, columnX + offsetX, y + offsetY, {
          width: availableWidth,
          align,
          lineBreak,
          ellipsis: !lineBreak,
          lineGap,
        });
      doc.y = y;
      doc.x = startX;
    });
    drawGridLines(y, y + headerHeight, includeTopBorder, null);
  };

  const drawHeaderRow = () => {
    ensurePageSpace(doc, headerHeight + 6);
    const top = doc.y;
    renderHeaderRowAt(top, true);
    doc.y = top + headerHeight;
  };

  const drawFooterRow = () => {
    if (!options.repeatHeaderAtBottom) {
      return;
    }
    const footerTop = pageBottom - headerHeight;
    const previousY = doc.y;
    renderHeaderRowAt(footerTop, true);
    doc.y = previousY;
  };

  const drawDataRow = (row: readonly string[], rowIndex: number) => {
    const cells: TableCellConfig[] = row.map((cell, cellIndex) => {
      const isNameColumn = cellIndex === 1;
      const defaultStyle: TableCellStyle = {
        align: isNameColumn ? "left" : "center",
        font: isNameColumn ? "bold" : "regular",
        fontSize: isNameColumn ? 8 : 7.4,
        textColor: isNameColumn ? "#111827" : "#1f2937",
      };
      const style = { ...defaultStyle, ...(options.cellStyles?.[rowIndex]?.[cellIndex] ?? {}) } satisfies TableCellStyle;
      return { text: cell, style };
    });

    const rowHeight = computeRowHeight(cells);
    if (doc.y + rowHeight > tableBottom) {
      drawFooterRow();
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
      drawHeaderRow();
    }

    const rowBackground = options.rowBackgrounds?.[rowIndex];
    if (rowBackground) {
      doc.save();
      doc.rect(startX, doc.y, totalWidth, rowHeight).fill(rowBackground);
      doc.restore();
    } else if (rowIndex % 2 === 1) {
      doc.save();
      doc.rect(startX, doc.y, totalWidth, rowHeight).fill("#f9fafb");
      doc.restore();
    }

    const rowTop = doc.y;
    cells.forEach((cell, cellIndex) => {
      if (mergedCellLookup.has(`${rowIndex}:${cellIndex}`)) {
        return;
      }
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
      const lineBreak = cell.style.lineBreak ?? false;
      const lineGap = cell.style.lineGap;

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
            lineBreak,
            lineGap,
          })
        : 0;
      const contentOffsetY = cell.style.contentOffsetY ?? 0;
      const secondaryHeight = secondaryText
        ? doc
            .font(secondaryFont)
            .fontSize(secondaryFontSize)
            .heightOfString(secondaryText, {
              width: textWidth,
              align,
              lineBreak: false,
            })
        : 0;
      const totalTextHeight = (text ? primaryHeight : 0) + (secondaryText ? spacing + secondaryHeight : 0);
      const availableHeight = Math.max(rowHeight - paddingY * 2, 0);
      const verticalAlign = cell.style.verticalAlign ?? "top";
      let textStartY = rowTop + paddingY + contentOffsetY;
      if (verticalAlign === "middle") {
        textStartY = rowTop + paddingY + Math.max((availableHeight - totalTextHeight) / 2, 0) + contentOffsetY;
      }
      if (verticalAlign === "bottom") {
        textStartY = rowTop + rowHeight - paddingY - totalTextHeight + contentOffsetY;
      }

      if (text) {
        doc
          .font(font)
          .fontSize(fontSize)
          .fillColor(textColor)
          .text(text, x + paddingX + iconWidth, textStartY, {
            width: textWidth,
            align,
            lineBreak,
            ellipsis: !lineBreak,
            lineGap,
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
    rowMetrics[rowIndex] = { top: rowTop, height: rowHeight };
    drawGridLines(rowTop, doc.y, false, rowIndex);
  };

  drawHeaderRow();
  rows.forEach((row, index) => {
    drawDataRow(row, index);
  });
  if (mergedColumnGroups.length) {
    const savedX = doc.x;
    const savedY = doc.y;
    mergedColumnGroups.forEach((columnGroup) => {
      const columnIndex = columnGroup.columnIndex;
      const columnX = columnPositions[columnIndex];
      const columnWidth = columnWidths[columnIndex];
      columnGroup.groups.forEach((group) => {
        const { startRow, rowSpan, text } = group;
        const rowsForGroup = rowMetrics.slice(startRow, startRow + rowSpan);
        if (!rowsForGroup.length) {
          return;
        }
        const top = rowsForGroup[0]?.top ?? 0;
        const height = rowsForGroup.reduce((sum, metric) => sum + metric.height, 0);
        if (height <= 0) {
          return;
        }
        const style: TableCellStyle = {
          align: "center",
          font: "bold",
          fontSize: 7.3,
          textColor: "#111827",
          verticalAlign: "middle",
          ...group.style,
        };
        if (style.fillColor) {
          doc.save();
          doc.rect(columnX, top, columnWidth, height).fill(style.fillColor);
          doc.restore();
        }

        const paddingX = 5;
        const paddingY = 3;
        const availableWidth = Math.max(columnWidth - paddingX * 2, 8);
        const availableHeight = Math.max(height - paddingY * 2, 8);
        const rotation = ((style.rotate ?? 0) % 360 + 360) % 360;
        const font = resolveFont(style);
        const fontSize = style.fontSize ?? 9;
        const textColor = style.textColor ?? "#1f2937";
        const align = resolveAlign(style);
        const verticalAlign = style.verticalAlign ?? "middle";
        doc.font(font).fontSize(fontSize);
        const lineBreak = style.lineBreak ?? false;
        const lineGap = style.lineGap;
        let textWidth = 0;
        let textHeight = 0;
        if (lineBreak) {
          textWidth = availableWidth;
          textHeight = doc.heightOfString(text, {
            width: availableWidth,
            align,
            lineGap,
            lineBreak: true,
          });
        } else {
          textWidth = doc.widthOfString(text);
          textHeight = doc.currentLineHeight();
        }

        const normalizedRotation = rotation % 360;
        if (normalizedRotation === 90 || normalizedRotation === 270) {
          const centerX = columnX + paddingX + availableWidth / 2;
          const centerY = top + paddingY + availableHeight / 2;
          const drawWidth = textWidth;
          const drawHeight = textHeight;
          doc.save();
          doc.rotate(normalizedRotation, { origin: [centerX, centerY] });
          const textX = centerX - drawWidth / 2;
          const textY = centerY - drawHeight / 2;
          doc
            .font(font)
            .fontSize(fontSize)
            .fillColor(textColor)
            .text(text, textX, textY, {
              width: drawWidth,
              align: "center",
              lineBreak: false,
            });
          doc.restore();
        } else {
          const horizontalSpace = availableWidth - textWidth;
          let offsetX = paddingX;
          if (align === "center") {
            offsetX = paddingX + Math.max(horizontalSpace / 2, 0);
          }
          if (align === "right") {
            offsetX = paddingX + Math.max(horizontalSpace, 0);
          }

          let offsetY = paddingY;
          const verticalSpace = availableHeight - textHeight;
          if (verticalAlign === "middle") {
            offsetY = paddingY + Math.max(verticalSpace / 2, 0);
          }
          if (verticalAlign === "bottom") {
            offsetY = paddingY + Math.max(verticalSpace, 0);
          }
          doc
            .font(font)
            .fontSize(fontSize)
            .fillColor(textColor)
            .text(text, columnX + offsetX, top + offsetY, {
              width: availableWidth,
              align,
              lineBreak,
              ellipsis: !lineBreak,
              lineGap,
            });
        }
      });
    });
    doc.x = savedX;
    doc.y = savedY;
  }
  drawFooterRow();
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

    const zoneColumnWidth = 28;
    const columnWidths = [zoneColumnWidth, nameWidth, ...Array(dayCount).fill(dayWidth)];

    const headers: string[] = ["Zone", "Mitglied", ...data.days.map((day) => day.label)];
    const dayLookup = new Map(data.days.map((day, index) => [day.key, index] as const));

    const zonePalette: Record<MemberZone, { rowFill: string | null; columnFill: string; textColor: string; columnLabel: string }> = {
      acting: {
        rowFill: "#eef2ff",
        columnFill: "#e0e7ff",
        textColor: "#312e81",
        columnLabel: "Schauspiel",
      },
      crew: {
        rowFill: "#ecfdf5",
        columnFill: "#d1fae5",
        textColor: "#065f46",
        columnLabel: "Gewerke",
      },
      both: {
        rowFill: "#fef3c7",
        columnFill: "#fde68a",
        textColor: "#92400e",
        columnLabel: "Beides",
      },
      unknown: {
        rowFill: "#f3f4f6",
        columnFill: "#e5e7eb",
        textColor: "#374151",
        columnLabel: "–",
      },
    };

    const rowBackgrounds: (string | null)[] = [];

    const zoneSortOrder: MemberZone[] = ["acting", "both", "crew", "unknown"];
    const members = [...data.members].sort((a, b) => {
      const zoneA = (a.zone ?? "unknown") as MemberZone;
      const zoneB = (b.zone ?? "unknown") as MemberZone;
      const zoneIndexDifference = zoneSortOrder.indexOf(zoneA) - zoneSortOrder.indexOf(zoneB);
      if (zoneIndexDifference !== 0) {
        return zoneIndexDifference;
      }

      return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
    });

    const rowDefinitions = members.map((member) => {
      const zone = (member.zone ?? "unknown") as MemberZone;
      const zoneConfig = zonePalette[zone] ?? zonePalette.unknown;
      const cells = Array<string>(dayCount).fill("–");
      const styles: TableCellStyle[] = Array.from({ length: dayCount }, () => ({
        align: "center",
        fontSize: 7.2,
        textColor: "#9ca3af",
        prefixIcon: null,
        verticalAlign: "middle",
      }));

      member.entries.forEach((entry, entryIndex) => {
        const columnIndex = dayLookup.get(entry.dayKey) ?? entryIndex;
        if (columnIndex >= dayCount) {
          return;
        }

        const status = (entry.status ?? "none") as MemberEntryStatus;
        if (status === "none") {
          return;
        }

        const normalized = entry.value?.replace(/\s+/g, " ").trim() ?? "";
        const lower = normalized.toLowerCase();
        const truncate = (value: string) =>
          value.length > 60 ? `${value.slice(0, 57).trimEnd()}…` : value;
        const iconSize = 10;

        if (status === "blocked") {
          if (lower === "frei" || lower === "verfügbar") {
            return;
          }

          const isGeneric = lower === "gesperrt";
          const truncated = truncate(normalized);
          cells[columnIndex] = "";
          styles[columnIndex] = {
            align: "center",
            font: "bold",
            fontSize: 7.5,
            textColor: "#7f1d1d",
            fillColor: isGeneric ? "#fee2e2" : "#fef2f2",
            prefixIcon: {
              type: "cross",
              size: iconSize,
              strokeColor: "#b91c1c",
              align: "center",
              verticalAlign: isGeneric ? "middle" : "top",
            },
            verticalAlign: isGeneric ? "middle" : "top",
            contentOffsetY: isGeneric ? undefined : iconSize + 3,
            secondaryText: isGeneric ? null : truncated,
            secondaryFont: isGeneric ? undefined : "regular",
            secondaryFontSize: isGeneric ? undefined : 6.3,
            secondaryTextColor: isGeneric ? undefined : "#991b1b",
            secondarySpacing: isGeneric ? undefined : 2,
          };
          return;
        }

        if (status === "limited" || status === "preferred") {
          const baseLabel = status === "limited" ? "eingeschränkt" : "bevorzugt";
          const displayLabel = `${baseLabel.charAt(0).toUpperCase()}${baseLabel.slice(1)}`;
          const hasCustomReason = normalized && lower !== baseLabel;
          const truncated = hasCustomReason ? truncate(normalized) : null;
          const palette =
            status === "limited"
              ? {
                  fill: "#fef3c7",
                  text: "#92400e",
                  secondary: "#92400e",
                }
              : {
                  fill: "#d1fae5",
                  text: "#065f46",
                  secondary: "#047857",
                };

          cells[columnIndex] = displayLabel;
          styles[columnIndex] = {
            align: "center",
            font: "bold",
            fontSize: 7.3,
            textColor: palette.text,
            fillColor: palette.fill,
            verticalAlign: "middle",
            secondaryText: truncated,
            secondaryFont: truncated ? "regular" : undefined,
            secondaryFontSize: truncated ? 6.2 : undefined,
            secondaryTextColor: truncated ? palette.secondary : undefined,
            secondarySpacing: truncated ? 1.6 : undefined,
            lineGap: truncated ? 1.2 : undefined,
          };
          return;
        }
      });

      const trimmedEmail = member.email?.trim() ?? "";
      const zoneCellStyle: TableCellStyle = {
        align: "center",
        font: "bold",
        fontSize: 7.3,
        textColor: zoneConfig.textColor,
        fillColor: zoneConfig.columnFill,
        verticalAlign: "middle",
        rotate: -90,
        affectsRowHeight: false,
      };
      const nameCellStyle: TableCellStyle = {
        font: "bold",
        fontSize: 8.5,
        textColor: "#111827",
        secondaryText: trimmedEmail || null,
        secondaryFont: "regular",
        secondaryFontSize: trimmedEmail ? 6.4 : undefined,
        secondaryTextColor: trimmedEmail ? "#6b7280" : undefined,
        secondarySpacing: trimmedEmail ? 1.2 : undefined,
        verticalAlign: "middle",
      };

      rowBackgrounds.push(zoneConfig.rowFill);

      return {
        zone,
        zoneLabel: zoneConfig.columnLabel,
        zoneStyle: zoneCellStyle,
        values: [zoneConfig.columnLabel, member.name, ...cells] as const,
        styles: [zoneCellStyle, nameCellStyle, ...styles],
      };
    });

    const rows = rowDefinitions.map((row) => row.values);
    const cellStyles = rowDefinitions.map((row) => row.styles);

    const mergedColumnGroups: TableMergedColumnGroup[] = [];
    if (rowDefinitions.length > 0) {
      type ZoneGroup = { startRow: number; rowSpan: number; zone: MemberZone };
      const zoneGroups: ZoneGroup[] = [];
      let current: ZoneGroup | null = null;
      rowDefinitions.forEach((row, index) => {
        if (!current || row.zone !== current.zone) {
          current = { startRow: index, rowSpan: 1, zone: row.zone };
          zoneGroups.push(current);
          return;
        }
        current.rowSpan += 1;
      });

      mergedColumnGroups.push({
        columnIndex: 0,
        groups: zoneGroups.map((group) => ({
          startRow: group.startRow,
          rowSpan: group.rowSpan,
          text: rowDefinitions[group.startRow]?.zoneLabel ?? "",
          style: rowDefinitions[group.startRow]?.zoneStyle,
        })),
      });
    }

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Sperrtermine im Überblick");
    doc.moveDown(0.4);

    drawTable(
      doc,
      headers,
      rows,
      columnWidths,
      {
        headerStyles: headers.map(() => ({ align: "center", verticalAlign: "middle" })),
        cellStyles,
        rowBackgrounds,
        repeatHeaderAtBottom: true,
        mergedColumnGroups,
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
