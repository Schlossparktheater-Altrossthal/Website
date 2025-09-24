import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const FONT_DEFINITIONS: ReadonlyArray<{ id: string; file: string }> = [
  { id: "Helvetica", file: "Inter-Regular.ttf" },
  { id: "Helvetica-Bold", file: "Inter-Bold.ttf" },
];

const FONT_DIRECTORY = path.join(process.cwd(), "public", "fonts", "pdf");

const FONT_SIGNATURES = new Set<number>([
  0x00010000, // TrueType
  0x4f54544f, // OpenType ("OTTO")
  0x74746366, // TrueType Collection ("ttcf")
  0x74727565, // legacy Apple TrueType ("true")
  0x74797031, // Type 1 in sfnt wrapper ("typ1")
]);

const fontSupportCache = new Map<string, boolean>();
const missingFontWarnings = new Set<string>();
const unsupportedFontWarnings = new Set<string>();
const registrationFailureWarnings = new Set<string>();

function hasSupportedSignature(absolutePath: string): boolean {
  const cached = fontSupportCache.get(absolutePath);
  if (typeof cached === "boolean") {
    return cached;
  }

  let supported = false;
  try {
    const buffer = readFileSync(absolutePath);
    if (buffer.length >= 4) {
      const signature = buffer.readUInt32BE(0);
      supported = FONT_SIGNATURES.has(signature);
    }
  } catch {
    supported = false;
  }

  fontSupportCache.set(absolutePath, supported);
  return supported;
}

export function registerDefaultPdfFonts(doc: PDFKit.PDFDocument) {
  for (const { id, file } of FONT_DEFINITIONS) {
    const absolutePath = path.join(FONT_DIRECTORY, file);

    if (!existsSync(absolutePath)) {
      if (!missingFontWarnings.has(absolutePath)) {
        missingFontWarnings.add(absolutePath);
        console.warn(
          `[pdf] Schriftart ${file} (${absolutePath}) wurde nicht gefunden. Verwende Standard-PDFKit-Schriften.`,
        );
      }
      continue;
    }

    if (!hasSupportedSignature(absolutePath)) {
      if (!unsupportedFontWarnings.has(absolutePath)) {
        unsupportedFontWarnings.add(absolutePath);
        console.warn(
          `[pdf] Schriftart ${file} (${absolutePath}) hat ein nicht unterstütztes Format. Verwende Standard-PDFKit-Schriften.`,
        );
      }
      continue;
    }

    try {
      doc.registerFont(id, absolutePath);
    } catch (error) {
      const key = `${id}:${absolutePath}`;
      if (!registrationFailureWarnings.has(key)) {
        registrationFailureWarnings.add(key);
        console.warn(
          `[pdf] Schriftart ${file} (${absolutePath}) konnte nicht registriert werden. Verwende Standard-PDFKit-Schriften.`,
          error,
        );
      }
    }
  }
}
