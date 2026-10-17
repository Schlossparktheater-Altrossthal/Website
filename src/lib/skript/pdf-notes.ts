import {
  SCRIPT_SIGNS,
  SKETCH_HEIGHT,
  type AnnotationColor,
  type InkColor,
  type ReaderAnnotation,
} from "./annotation-types";

/**
 * Eigene Notizen im PDF (docs/Plan/skript-ansicht-plan.md): fürs Papier gesetzt statt wie im
 * Leser – Markierung farbig unterstrichen, Zeichen als Glyphe im Text, Notiztexte nummeriert unter
 * dem Absatz, Zettel als kleine Zeichnung. Nur Helvetica-taugliche Zeichen (WinAnsi).
 */

export type PdfNote = Pick<
  ReaderAnnotation,
  | "id"
  | "kind"
  | "sign"
  | "strokes"
  | "color"
  | "body"
  | "partIndex"
  | "start"
  | "end"
  | "quote"
  | "blockId"
  | "state"
>;

/** Druckfarben der Markerfarben (dunkel genug für Text auf Weiß). */
export const NOTE_PRINT_COLORS: Record<AnnotationColor, string> = {
  gelb: "#b45309",
  gruen: "#15803d",
  blau: "#1d4ed8",
  rosa: "#be185d",
};
export const NOTE_DEFAULT_COLOR = "#7c3aed";

export const INK_PRINT_COLORS: Record<InkColor, string> = {
  schwarz: "#1c1917",
  rot: "#dc2626",
  blau: "#2563eb",
  gruen: "#16a34a",
};

/** Zeichen, die Helvetica nicht kennt, durch druckbare ersetzen. */
const PRINT_GLYPHS: Partial<Record<keyof typeof SCRIPT_SIGNS, string>> = {
  zaesur: "||",
};

export type Decoration = {
  start: number;
  end: number;
  color: string;
  underline: boolean;
  bold: boolean;
  /** Text im Bereich in der Notizfarbe (nicht bei Etiketten wie „(lauter)“). */
  tint?: boolean;
  /** Vor dem Bereich (z. B. „(lauter)“) bzw. an der Stelle eines Punkt-Zeichens. */
  before?: string;
  /** Hinter dem Bereich (Notiznummer „[1]“). */
  after?: string;
};

export type BlockNotes = {
  /** Dekorationen je Teil (Index in `block.parts`). */
  parts: Map<number, Decoration[]>;
  /** Ganzer Absatz markiert: Farbe des Randstrichs. */
  blockColor: string | null;
  /** Notiztexte unter dem Absatz, mit Nummer, falls im Text verankert. */
  lines: { number: number | null; quote: string | null; body: string; color: string }[];
  sketches: PdfNote["strokes"][];
};

const colorOf = (note: Pick<PdfNote, "color">) =>
  note.color ? NOTE_PRINT_COLORS[note.color] : NOTE_DEFAULT_COLOR;

/**
 * Notizen eines Absatzes fürs PDF aufbereiten. `counter` zählt die Notiznummern über das ganze
 * Dokument weiter.
 */
export function blockNotes(notes: readonly PdfNote[], counter: { value: number }): BlockNotes {
  const result: BlockNotes = { parts: new Map(), blockColor: null, lines: [], sketches: [] };
  const add = (partIndex: number, decoration: Decoration) =>
    result.parts.set(partIndex, [...(result.parts.get(partIndex) ?? []), decoration]);
  for (const note of notes) {
    if (note.state === "orphaned") continue;
    // Nur sicher verankerte Stellen im Text markieren; sonst bleibt die Notiz unter dem Absatz.
    const anchored =
      note.state === "ok" && note.partIndex !== null && note.start !== null && note.end !== null;
    if (note.kind === "ink") {
      if (note.strokes.length) result.sketches.push(note.strokes);
      continue;
    }
    if (note.kind === "highlight") {
      if (note.partIndex === null) result.blockColor = colorOf(note);
      else if (anchored) {
        add(note.partIndex as number, {
          start: note.start as number,
          end: note.end as number,
          color: colorOf(note),
          underline: true,
          bold: false,
          tint: true,
        });
      }
      continue;
    }
    if (note.kind === "sign" && note.sign) {
      if (!anchored) continue;
      const sign = SCRIPT_SIGNS[note.sign];
      const glyph = PRINT_GLYPHS[note.sign] ?? sign.glyph;
      const start = note.start as number;
      const end = note.end as number;
      const color = colorOf(note);
      if (sign.point) {
        add(note.partIndex as number, {
          start,
          end: start,
          color,
          underline: false,
          bold: true,
          before: ` ${glyph} `,
        });
      } else if (note.sign === "betonung" || note.sign === "betonung_stark") {
        add(note.partIndex as number, {
          start,
          end,
          color,
          underline: true,
          bold: note.sign === "betonung_stark",
          tint: true,
        });
      } else {
        // lauter/leiser/…, Bogen, Stimmung: Etikett vor dem Bereich.
        const label = note.sign === "stimmung" ? (note.body ?? sign.short) : sign.short;
        add(note.partIndex as number, {
          start,
          end,
          color,
          underline: false,
          bold: false,
          before: `(${label}) `,
        });
      }
      continue;
    }
    if (note.kind === "note" && note.body?.trim()) {
      const color = colorOf(note);
      if (anchored) {
        counter.value += 1;
        const number = counter.value;
        add(note.partIndex as number, {
          start: note.start as number,
          end: note.end as number,
          color,
          underline: true,
          bold: false,
          tint: true,
          after: `[${number}]`,
        });
        result.lines.push({ number, quote: null, body: note.body.trim(), color });
      } else {
        result.lines.push({
          number: null,
          quote: note.partIndex !== null ? note.quote : null,
          body: note.body.trim(),
          color,
        });
      }
    }
  }
  return result;
}

export type Segment = {
  text: string;
  /** Dekorationen, die den ganzen Abschnitt abdecken. */
  covering: Decoration[];
  /** Einschübe vor dem Abschnitt (Punkt-Zeichen, Etiketten, Notiznummern). */
  inserts: { text: string; color: string }[];
};

/**
 * Text eines Teils an allen Dekorationsgrenzen (und `extraCuts`) zerlegen. Einschübe stehen an
 * ihrer Stelle; was hinter dem Text steht, kommt als letzter, leerer Abschnitt.
 */
export function segmentText(
  text: string,
  decorations: readonly Decoration[],
  extraCuts: readonly number[] = [],
): Segment[] {
  const length = text.length;
  const clamp = (n: number) => Math.max(0, Math.min(length, n));
  const cuts = new Set<number>([0, length, ...extraCuts.map(clamp)]);
  for (const d of decorations) {
    cuts.add(clamp(d.start));
    cuts.add(clamp(d.end));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const insertsAt = (at: number) => [
    // Erst was hinter einem Bereich steht (Notiznummer), dann was vor dem nächsten steht.
    ...decorations
      .filter((d) => d.after && clamp(d.end) === at)
      .map((d) => ({ text: d.after as string, color: d.color })),
    ...decorations
      .filter((d) => d.before && clamp(d.start) === at)
      .map((d) => ({ text: d.before as string, color: d.color })),
  ];
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    segments.push({
      text: text.slice(a, b),
      covering: decorations.filter(
        (d) => clamp(d.start) <= a && clamp(d.end) >= b && d.end > d.start,
      ),
      inserts: insertsAt(a),
    });
  }
  const tail = insertsAt(length);
  if (tail.length || !segments.length) segments.push({ text: "", covering: [], inserts: tail });
  return segments;
}

/** Zettel (Freihand) als Vektorzeichnung in einen Kasten zeichnen. */
export function drawSketch(
  doc: PDFKit.PDFDocument,
  strokes: PdfNote["strokes"],
  x: number,
  y: number,
  width: number,
) {
  const height = width * SKETCH_HEIGHT;
  doc.save();
  doc.rect(x, y, width, height).lineWidth(0.5).strokeColor("#d6d3d1").stroke();
  doc.lineCap("round").lineJoin("round");
  for (const stroke of strokes) {
    const color = INK_PRINT_COLORS[stroke.color];
    const [first, ...rest] = stroke.points;
    if (!first) continue;
    const pressure =
      stroke.points.reduce((sum, point) => sum + (point[2] || 0.5), 0) / stroke.points.length;
    doc.lineWidth(Math.max(0.4, stroke.size * width * (0.5 + pressure)));
    doc.moveTo(x + first[0] * width, y + first[1] * width);
    if (!rest.length) doc.lineTo(x + first[0] * width + 0.1, y + first[1] * width);
    for (const point of rest) doc.lineTo(x + point[0] * width, y + point[1] * width);
    doc.strokeColor(color).stroke();
  }
  doc.restore();
  return height;
}
