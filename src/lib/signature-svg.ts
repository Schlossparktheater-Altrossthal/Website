import type { SignaturePayload } from "@/types/signature";

export type SignatureSvgGeometry = {
  /** viewBox um die Unterschrift herum, mit etwas Rand. */
  viewBox: string;
  /** Ein Pfad je Strich, geglättet über Mittelpunkte (quadratische Kurven). */
  paths: string[];
};

const PADDING = 8;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Wandelt eine vektoriell erfasste Unterschrift (`velocity.v1`) in SVG-Pfade um. */
export function signatureToSvgGeometry(payload: SignaturePayload): SignatureSvgGeometry {
  const paths = payload.strokes.flatMap((stroke) => {
    const points = stroke.points;
    if (points.length === 0) return [];
    const [first] = points;
    if (points.length === 1) {
      // Ein einzelner Punkt wird als kurzer Strich sichtbar.
      return [`M${round(first.x)} ${round(first.y)}l0.1 0`];
    }
    let d = `M${round(first.x)} ${round(first.y)}`;
    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index];
      const next = points[index + 1];
      const midX = (point.x + next.x) / 2;
      const midY = (point.y + next.y) / 2;
      d += `Q${round(point.x)} ${round(point.y)} ${round(midX)} ${round(midY)}`;
    }
    const last = points[points.length - 1];
    d += `L${round(last.x)} ${round(last.y)}`;
    return [d];
  });

  const box = payload.boundingBox;
  const hasBox = box.maxX > box.minX || box.maxY > box.minY;
  const minX = hasBox ? box.minX - PADDING : 0;
  const minY = hasBox ? box.minY - PADDING : 0;
  const width = hasBox ? box.maxX - box.minX + PADDING * 2 : payload.width;
  const height = hasBox ? box.maxY - box.minY + PADDING * 2 : payload.height;

  return {
    viewBox: `${round(minX)} ${round(minY)} ${round(Math.max(width, 1))} ${round(Math.max(height, 1))}`,
    paths,
  };
}

/** Eigenständiges SVG-Dokument (z. B. für Downloads oder PDF-Einbettung). */
export function signatureToSvgString(
  payload: SignaturePayload,
  options: { stroke?: string; strokeWidth?: number } = {},
): string {
  const { viewBox, paths } = signatureToSvgGeometry(payload);
  const stroke = options.stroke ?? "#111827";
  const strokeWidth = options.strokeWidth ?? 2;
  const body = paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}
