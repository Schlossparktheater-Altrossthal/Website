import { existsSync } from "node:fs";
import path from "node:path";

const FONT_DEFINITIONS: ReadonlyArray<{ id: string; file: string }> = [
  { id: "Helvetica", file: "Inter-Regular.ttf" },
  { id: "Helvetica-Bold", file: "Inter-Bold.ttf" },
];

const FONT_DIRECTORY = path.join(process.cwd(), "public", "fonts", "pdf");

export function registerDefaultPdfFonts(doc: PDFKit.PDFDocument) {
  for (const { id, file } of FONT_DEFINITIONS) {
    const absolutePath = path.join(FONT_DIRECTORY, file);
    if (!existsSync(absolutePath)) {
      throw new Error(`PDF font asset missing: ${absolutePath}`);
    }

    doc.registerFont(id, absolutePath);
  }
}
