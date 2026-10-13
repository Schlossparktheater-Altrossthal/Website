import type { ScriptProfile } from "./profiles";
import type { ColorName, TextLine, TextSpan } from "./types";

/**
 * Ebene 1: PDF → Zeilen mit Schriftschnitt, Textfarbe und Markierung.
 *
 * `getTextContent` fasst Läufe zusammen und kennt keine Farben; deshalb wird die Operatorliste
 * direkt gelesen: Schrift (`setFont`), Position (`setTextMatrix`/`moveText`), Farbe
 * (`setFillRGBColor`), Text (`showText`) und gefüllte Rechtecke (`constructPath` + Füllung) als
 * Markierungen.
 */

type Matrix = [number, number, number, number, number, number];

type GlyphRun = {
  page: number;
  x0: number;
  x1: number;
  /** Grundlinie, y von oben. */
  baseline: number;
  size: number;
  text: string;
  bold: boolean;
  italic: boolean;
  color: ColorName | null;
};

type Rect = { x0: number; x1: number; y0: number; y1: number; color: ColorName };

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Hex-Farbe → benannte Farbe; Schwarz/Weiß → `null`. */
export function colorName(hex: string | null | undefined): ColorName | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  if (r > 0.8 && g > 0.8 && b < 0.3) return "yellow";
  if (r < 0.3 && g > 0.8 && b > 0.8) return "cyan";
  if (r < 0.3 && g > 0.8 && b < 0.3) return "green";
  if (r > 0.8 && g < 0.3 && b > 0.8) return "magenta";
  if (r > 0.7 && g < 0.3 && b < 0.3) return "red";
  if (Math.abs(r - g) < 0.1 && Math.abs(g - b) < 0.1 && r > 0.3 && r < 0.8) return "grey";
  if (r < 0.15 && g < 0.15 && b < 0.15) return null;
  if (r > 0.9 && g > 0.9 && b > 0.9) return null;
  return "other";
}

const FILL_OPS = new Set(["fill", "eoFill", "fillStroke", "eoFillStroke"]);

/** pdfjs übergibt Zahlen je nach Operator einzeln oder als ein (typisiertes) Array. */
function numbers(args: unknown[]): number[] {
  const first = args[0];
  if (args.length === 1 && first && typeof first === "object" && "length" in first) {
    return Array.from(first as ArrayLike<number>, Number);
  }
  return args.map(Number);
}

function asMatrix(args: unknown[]): Matrix | null {
  const values = numbers(args).slice(0, 6);
  if (values.length < 6) return null;
  return values.every(Number.isFinite) ? (values as Matrix) : null;
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}

type Glyph = { unicode?: string; width?: number } | number | null;

export async function extractLines(data: Uint8Array, profile: ScriptProfile): Promise<TextLine[]> {
  const pdfjs = await loadPdfJs();
  const opName = new Map<number, string>(Object.entries(pdfjs.OPS).map(([k, v]) => [v, k]));
  const task = pdfjs.getDocument({
    data,
    useSystemFonts: false,
    // nötig, damit `commonObjs` den Schriftnamen (z. B. „Arial-BoldMT“) liefert
    fontExtraProperties: true,
  });
  const doc = await task.promise;
  const lines: TextLine[] = [];
  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const height = page.view[3] - page.view[1];
      const ops = await page.getOperatorList();
      const runs: GlyphRun[] = [];
      const rects: Rect[] = [];
      const stack: { ctm: Matrix; fill: string | null }[] = [];
      let ctm: Matrix = IDENTITY;
      let fill: string | null = null;
      let fontName = "";
      let fontSize = 12;
      let charSpacing = 0;
      let leading = 0;
      let textMatrix: Matrix = IDENTITY;
      let lineMatrix: Matrix = IDENTITY;

      for (let i = 0; i < ops.fnArray.length; i++) {
        const name = opName.get(ops.fnArray[i]);
        const args = ops.argsArray[i] as unknown[];
        switch (name) {
          case "save":
            stack.push({ ctm, fill });
            break;
          case "restore": {
            const prev = stack.pop();
            if (prev) ({ ctm, fill } = prev);
            break;
          }
          case "transform": {
            const m = asMatrix(args);
            if (m) ctm = multiply(m, ctm);
            break;
          }
          case "setFillRGBColor":
            fill = typeof args[0] === "string" ? args[0] : null;
            break;
          case "setFont": {
            const id = String(args[0]);
            fontSize = Math.abs(Number(args[1])) || fontSize;
            let font: { name?: string } | undefined;
            try {
              font = page.commonObjs.get(id) as { name?: string };
            } catch {
              font = undefined; // Schrift (noch) nicht aufgelöst – Name bleibt die interne ID
            }
            fontName = font?.name ?? id;
            break;
          }
          case "setCharSpacing":
            charSpacing = Number(args[0]) || 0;
            break;
          case "setLeading":
            leading = Number(args[0]) || 0;
            break;
          case "beginText":
            textMatrix = lineMatrix = IDENTITY;
            break;
          case "setTextMatrix": {
            const m = asMatrix(args);
            if (m) textMatrix = lineMatrix = m;
            break;
          }
          case "moveText":
          case "setLeadingMoveText": {
            const [tx = 0, ty = 0] = numbers(args).map((v) => v || 0);
            if (name === "setLeadingMoveText") leading = -ty;
            textMatrix = lineMatrix = multiply([1, 0, 0, 1, tx, ty], lineMatrix);
            break;
          }
          case "nextLine":
            textMatrix = lineMatrix = multiply([1, 0, 0, 1, 0, -leading], lineMatrix);
            break;
          case "showText":
          case "showSpacedText": {
            const glyphs = (args[0] ?? []) as Glyph[];
            let advance = 0;
            let text = "";
            for (const glyph of glyphs) {
              if (typeof glyph === "number") {
                advance -= (glyph / 1000) * fontSize;
              } else if (glyph) {
                text += glyph.unicode ?? "";
                advance += ((glyph.width ?? 0) / 1000) * fontSize + charSpacing;
              } else {
                text += " ";
              }
            }
            const m = multiply(textMatrix, ctm);
            const [x0, y] = apply(m, 0, 0);
            const [x1] = apply(m, advance, 0);
            const scale = Math.hypot(m[2], m[3]) || 1;
            runs.push({
              page: pageNo,
              x0,
              x1,
              baseline: height - y,
              size: fontSize * scale,
              text,
              bold: /bold|black|heavy|semibold|demi/i.test(fontName),
              italic: /italic|oblique/i.test(fontName),
              color: colorName(fill),
            });
            textMatrix = multiply([1, 0, 0, 1, advance, 0], textMatrix);
            break;
          }
          case "constructPath": {
            const paint = opName.get(Number(args[0]));
            const color = colorName(fill);
            const bbox = args[2] as ArrayLike<number> | undefined;
            if (paint && FILL_OPS.has(paint) && color && bbox && bbox.length >= 4) {
              const [ax, ay] = apply(ctm, bbox[0], bbox[1]);
              const [bx, by] = apply(ctm, bbox[2], bbox[3]);
              // Ganzseitige Flächen (Hintergrund) sind keine Markierung.
              if (Math.abs(bx - ax) < (page.view[2] - page.view[0]) * 0.9) {
                rects.push({
                  x0: Math.min(ax, bx),
                  x1: Math.max(ax, bx),
                  y0: height - Math.max(ay, by),
                  y1: height - Math.min(ay, by),
                  color,
                });
              }
            }
            break;
          }
          default:
            break;
        }
      }
      lines.push(...groupLines(runs, rects, height, profile));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return lines;
}

function highlightFor(run: GlyphRun, rects: Rect[]): ColorName | null {
  const top = run.baseline - run.size * 0.8;
  const width = run.x1 - run.x0;
  let hit: ColorName | null = null;
  for (const rect of rects) {
    const overlapX = Math.min(rect.x1, run.x1) - Math.max(rect.x0, run.x0);
    const overlapY = Math.min(rect.y1, run.baseline) - Math.max(rect.y0, top);
    if (overlapY > 0 && overlapX > Math.max(width * 0.5, 0.5)) hit = rect.color;
  }
  return hit;
}

/** Läufe derselben Grundlinie zu Zeilen, gleiche Formatierung zu Spans zusammenfassen. */
export function groupLines(
  runs: GlyphRun[],
  rects: Rect[],
  pageHeight: number,
  profile: ScriptProfile,
): TextLine[] {
  const sorted = [...runs].sort((a, b) => a.baseline - b.baseline || a.x0 - b.x0);
  const rows: GlyphRun[][] = [];
  for (const run of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].baseline - run.baseline) < run.size * 0.3) row.push(run);
    else rows.push([run]);
  }
  const lines: TextLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    const spans: TextSpan[] = [];
    for (const run of row) {
      const span: TextSpan = {
        text: run.text,
        bold: run.bold,
        italic: run.italic,
        color: run.color,
        highlight: run.text.trim() ? highlightFor(run, rects) : null,
      };
      const last = spans.at(-1);
      if (!span.text.trim() && last) {
        last.text += span.text;
      } else if (
        last &&
        last.bold === span.bold &&
        last.italic === span.italic &&
        last.color === span.color &&
        last.highlight === span.highlight
      ) {
        last.text += span.text;
      } else {
        spans.push(span);
      }
    }
    const text = spans
      .map((s) => s.text)
      .join("")
      .trim();
    if (!text) continue;
    const baseline = row[0].baseline;
    if (/^\d{1,4}$/.test(text) && baseline > pageHeight * (1 - profile.pageNumberZone)) continue;
    lines.push({
      page: row[0].page,
      x0: row[0].x0,
      x1: Math.max(...row.filter((r) => r.text.trim()).map((r) => r.x1)),
      y: baseline - row[0].size,
      spans,
    });
  }
  return lines;
}
