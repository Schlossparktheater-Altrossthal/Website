import QRCode from "qrcode";

import type { LabelContentOptions, LabelSheetTemplate } from "@/lib/inventory/label-templates";
import { labelsPerSheet } from "@/lib/inventory/label-templates";
import { registerDefaultPdfFonts } from "@/lib/pdf/fonts";

export type LabelData = {
  code: string;
  url: string;
  title: string;
  subtitle: string | null;
  /** z. B. „Prüfung bis 03/2027“. */
  footnote: string | null;
};

const MM = 72 / 25.4;
const mm = (value: number) => value * MM;

/** QR-Code als Vektor-Rechtecke – bleibt bei jeder Etikettengröße scharf. */
function drawQr(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  size: number,
  small: boolean,
) {
  const qr = QRCode.create(text, { errorCorrectionLevel: small ? "L" : "M" });
  const count = qr.modules.size;
  const cell = size / count;
  doc.save().fillColor("#000000");
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.modules.get(row, column)) {
        // Minimal überlappen, damit zwischen Modulen keine Haarlinien entstehen.
        doc.rect(x + column * cell, y + row * cell, cell + 0.15, cell + 0.15);
      }
    }
  }
  doc.fill().restore();
}

function fitText(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  maxSize: number,
  minSize: number,
) {
  let size = maxSize;
  while (size > minSize && doc.fontSize(size).widthOfString(text) > width) {
    size -= 0.5;
  }
  return size;
}

function drawLabel(
  doc: PDFKit.PDFDocument,
  label: LabelData,
  x: number,
  y: number,
  template: LabelSheetTemplate,
  content: LabelContentOptions,
  organisation: string,
) {
  const width = mm(template.width);
  const height = mm(template.height);
  const pad = mm(Math.min(3, template.height * 0.09));
  const tiny = template.height < 25 || template.width < 45;
  const portrait = template.height > template.width * 1.1;

  if (portrait) {
    // Hochformat (A6): großer QR oben, Text darunter – für Regalschilder.
    const qrSize = Math.min(width - pad * 2, height * 0.6);
    drawQr(doc, label.url, x + (width - qrSize) / 2, y + pad, qrSize, false);
    let cursor = y + pad + qrSize + pad;
    const textWidth = width - pad * 2;
    doc.font("Helvetica-Bold").fontSize(fitText(doc, label.code, textWidth, 34, 12));
    doc.text(label.code, x + pad, cursor, { width: textWidth, align: "center", lineBreak: false });
    cursor += doc.currentLineHeight() + 4;
    if (content.showName) {
      doc.font("Helvetica").fontSize(16);
      doc.text(label.title, x + pad, cursor, {
        width: textWidth,
        align: "center",
        height: height * 0.18,
        ellipsis: true,
      });
    }
    if (content.showOrganisation) {
      doc.font("Helvetica").fontSize(8).fillColor("#555555");
      doc.text(organisation, x + pad, y + height - pad - 10, {
        width: textWidth,
        align: "center",
        lineBreak: false,
      });
      doc.fillColor("#000000");
    }
    return;
  }

  const qrSize = Math.min(height - pad * 2, width * (tiny ? 0.5 : 0.42));
  drawQr(doc, label.url, x + pad, y + (height - qrSize) / 2, qrSize, tiny);
  const textX = x + pad * 2 + qrSize;
  const textWidth = width - qrSize - pad * 3;
  if (textWidth < mm(8)) return;

  if (tiny) {
    doc.font("Helvetica-Bold").fontSize(fitText(doc, label.code, textWidth, 11, 5));
    doc.text(label.code, textX, y + height / 2 - doc.currentLineHeight() / 2, {
      width: textWidth,
      lineBreak: false,
    });
    return;
  }

  const scale = Math.min(1.6, template.height / 36);
  let cursor = y + pad;
  doc.font("Helvetica-Bold").fontSize(fitText(doc, label.code, textWidth, 15 * scale, 7));
  doc.text(label.code, textX, cursor, { width: textWidth, lineBreak: false });
  cursor += doc.currentLineHeight() + 1.5;

  const footerLines = [
    content.showInspection ? label.footnote : null,
    content.showOrganisation ? organisation : null,
  ].filter((line): line is string => Boolean(line));
  const footerHeight = footerLines.length * 7.5 * Math.max(1, scale * 0.9);
  const bodyBottom = y + height - pad - footerHeight;

  if (content.showName) {
    doc.font("Helvetica").fontSize(8.5 * scale);
    const available = Math.max(
      0,
      bodyBottom - cursor - (content.showArea && label.subtitle ? 8 * scale : 0),
    );
    if (available > 6) {
      doc.text(label.title, textX, cursor, { width: textWidth, height: available, ellipsis: true });
      cursor = Math.min(doc.y, cursor + available) + 1;
    }
  }
  if (content.showArea && label.subtitle && cursor + 7 < bodyBottom + 1) {
    doc
      .font("Helvetica")
      .fontSize(6.5 * scale)
      .fillColor("#444444");
    doc.text(label.subtitle, textX, cursor, { width: textWidth, lineBreak: false, ellipsis: true });
    doc.fillColor("#000000");
  }

  let footerY = y + height - pad - footerHeight;
  for (const line of footerLines) {
    const isOrganisation = line === organisation;
    doc
      .font(isOrganisation ? "Helvetica" : "Helvetica-Bold")
      .fontSize(6 * Math.max(1, scale * 0.9));
    doc.fillColor(isOrganisation ? "#555555" : "#000000");
    doc.text(line, textX, footerY, { width: textWidth, lineBreak: false, ellipsis: true });
    footerY += 7.5 * Math.max(1, scale * 0.9);
  }
  doc.fillColor("#000000");
}

/**
 * Erzeugt ein PDF mit Etiketten im Raster des Bogens. `skip` lässt die ersten Felder des ersten
 * Bogens frei, damit angebrochene Bögen weiterverwendet werden können.
 */
export async function renderLabelSheetPdf(input: {
  labels: LabelData[];
  template: LabelSheetTemplate;
  content: LabelContentOptions;
  skip: number;
  organisation: string;
  outlines: boolean;
}): Promise<Buffer> {
  const { default: PdfDocument } = await import("pdfkit");
  const doc = new PdfDocument({ size: "A4", margin: 0, autoFirstPage: true });
  registerDefaultPdfFonts(doc);
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const perSheet = labelsPerSheet(input.template);
  const skip = Math.max(0, Math.min(input.skip, perSheet - 1));
  input.labels.forEach((label, index) => {
    const slot = index + skip;
    const position = slot % perSheet;
    if (slot > 0 && position === 0) doc.addPage({ size: "A4", margin: 0 });
    const column = position % input.template.columns;
    const row = Math.floor(position / input.template.columns);
    const x = mm(input.template.marginLeft + column * (input.template.width + input.template.gapX));
    const y = mm(input.template.marginTop + row * (input.template.height + input.template.gapY));
    if (input.outlines) {
      doc.save().lineWidth(0.3).strokeColor("#bbbbbb");
      doc.rect(x, y, mm(input.template.width), mm(input.template.height)).stroke();
      doc.restore();
    }
    drawLabel(doc, label, x, y, input.template, input.content, input.organisation);
  });

  doc.end();
  return done;
}
