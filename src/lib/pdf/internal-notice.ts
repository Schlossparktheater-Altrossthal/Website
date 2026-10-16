export const INTERNAL_NOTICE_TEXT =
  "Nur für den internen Gebrauch · nicht weitergeben · nach Gebrauch vernichten";

/**
 * Setzt auf jeder Seite oben mittig den Hinweis „INTERN“. Liegt im oberen Seitenrand,
 * damit er keiner Vorlage in die Quere kommt. Braucht `bufferPages: true`.
 */
export function stampInternalNotice(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const { width } = doc.page;
    const top = doc.page.margins.top;
    const y = Math.max(6, Math.min(12, top / 2 - 4));

    // Ohne das legt PDFKit beim Schreiben außerhalb des Satzspiegels neue Seiten an.
    const margins = { ...doc.page.margins };
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

    const label = "INTERN";
    doc.font("Helvetica-Bold").fontSize(6);
    const labelWidth = doc.widthOfString(label) + 8;
    doc.font("Helvetica").fontSize(6);
    const textWidth = doc.widthOfString(INTERNAL_NOTICE_TEXT);
    const total = labelWidth + 6 + textWidth;
    const x = (width - total) / 2;

    doc.save();
    doc.roundedRect(x, y - 1.5, labelWidth, 9, 2).fill("#b91c1c");
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(6)
      .text(label, x, y, { width: labelWidth, align: "center", lineBreak: false });
    doc
      .fillColor("#6b7280")
      .font("Helvetica")
      .fontSize(6)
      .text(INTERNAL_NOTICE_TEXT, x + labelWidth + 6, y, { lineBreak: false });
    doc.restore();

    doc.page.margins = margins;
  }
}
