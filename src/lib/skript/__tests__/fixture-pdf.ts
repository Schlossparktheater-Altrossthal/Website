import PDFDocument from "pdfkit";

/**
 * Baut kleine Test-PDFs wie Word-Skripte: Rolle fett mit Doppelpunkt, Regie kursiv, Hinweise
 * mit farbigem Rechteck hinterlegt, Seitenzahl unten rechts. Keine echten Skripte im Repo.
 */
export type FixtureRun = {
  text: string;
  style?: "bold" | "italic" | "regular";
  /** Markierung als Hex-Farbe (gefülltes Rechteck hinter dem Text). */
  highlight?: string;
  /** Textfarbe als Hex. */
  color?: string;
};

export type FixtureLine = FixtureRun[];

const FONTS = { bold: "Helvetica-Bold", italic: "Helvetica-Oblique", regular: "Helvetica" };

export function buildScriptPdf(pages: FixtureLine[][]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
    pages.forEach((lines, index) => {
      doc.addPage();
      let y = 72;
      for (const line of lines) {
        let x = 71;
        for (const run of line) {
          doc.font(FONTS[run.style ?? "regular"]).fontSize(12);
          const width = doc.widthOfString(run.text);
          if (run.highlight) {
            doc.rect(x, y - 1, width, 14).fill(run.highlight);
          }
          doc.fillColor(run.color ?? "#000000").text(run.text, x, y, { lineBreak: false });
          x += width;
        }
        y += 21;
      }
      doc
        .font(FONTS.regular)
        .fillColor("#000000")
        .text(String(index + 1), 518, 791, {
          lineBreak: false,
        });
    });
    doc.end();
  });
}
