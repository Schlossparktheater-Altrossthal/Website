import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { readParts } from "./json";
import { similarity } from "./diff";
import { locatePoint, locateRange, pointContext, rangeContext } from "./note-logic";
import {
  ANNOTATION_COLORS,
  inkStrokeSchema,
  readSketch,
  isPointSign,
  SCRIPT_SIGN_KEYS,
  ScriptAnnotationError,
  type ScriptSign,
  type InkStroke,
  type AnnotationColor,
  type AnnotationState,
  type ReaderAnnotation,
} from "./annotation-types";
import type { ScriptPart } from "./types";

export {
  ANNOTATION_COLORS,
  ScriptAnnotationError,
  type AnnotationColor,
  type AnnotationState,
  type ReaderAnnotation,
};

/**
 * Markierungen und Notizen am Skript (docs/Plan/skript-plan.md, Phase 8). Zunächst privat:
 * jede Person sieht und ändert nur ihre eigenen (E8); Urheber und Zeitpunkt sind immer gespeichert.
 */

export const annotationInputSchema = z
  .object({
    /** Vom Leser vergebene Kennung, damit die Notiz sofort und dauerhaft gleich heißt. */
    id: z.string().uuid().optional(),
    versionId: z.string().min(1),
    blockId: z.string().min(1),
    kind: z.enum(["highlight", "note", "sign"]),
    color: z.enum(ANNOTATION_COLORS).nullable().default(null),
    sign: z
      .enum(SCRIPT_SIGN_KEYS as [ScriptSign, ...ScriptSign[]])
      .nullable()
      .default(null),
    body: z.string().trim().max(4000).nullable().default(null),
    partIndex: z.number().int().min(0).nullable().default(null),
    start: z.number().int().min(0).nullable().default(null),
    end: z.number().int().min(0).nullable().default(null),
  })
  .refine((value) => value.kind !== "note" || !!value.body, {
    message: "Die Notiz ist leer.",
  })
  .refine((value) => (value.kind === "sign") === !!value.sign, {
    message: "Unbekanntes Zeichen.",
  })
  .refine((value) => value.sign !== "stimmung" || !!value.body, {
    message: "Die Stimmung fehlt.",
  })
  .refine(
    (value) =>
      value.partIndex === null ||
      (value.start !== null &&
        value.end !== null &&
        // Stellen-Zeichen (Pause …) haben Anfang = Ende.
        (isPointSign(value.sign) ? value.end === value.start : value.end > value.start)),
    { message: "Ungültige Textstelle." },
  )
  .refine((value) => value.kind !== "sign" || value.partIndex !== null, {
    message: "Zeichen brauchen eine Textstelle.",
  });

export type AnnotationInput = z.input<typeof annotationInputSchema>;

/** Wortlaut eines Absatzes, wie er für Vergleiche gespeichert wird. */
export function plainBlockText(parts: ScriptPart[]) {
  return parts
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ganzer-Absatz-Notizen fragen erst bei größeren Änderungen nach (z. B. nicht bei einem Komma). */
const BLOCK_NOTE_SIMILARITY = 0.85;

/** Liegt die markierte Stelle noch so im Absatz? Sonst wird sie über Wortlaut + Umfeld gesucht. */
export function locateQuote(
  parts: ScriptPart[],
  anchor: {
    partIndex: number | null;
    start: number | null;
    end: number | null;
    quote: string | null;
    prefix?: string | null;
    suffix?: string | null;
  },
): { partIndex: number; start: number; end: number } | null {
  return locateRange(
    parts.map((part) => part.text),
    anchor,
  );
}

/** Sitzt an einer Stelle zwischen Wörtern: Pause & Co. sowie verankerte Notizzettel. */
function isPointAnchor(annotation: {
  kind: string;
  sign: string | null;
  partIndex: number | null;
}) {
  return (
    isPointSign(signOf(annotation.sign)) ||
    (annotation.kind === "ink" && annotation.partIndex !== null)
  );
}

function signOf(value: string | null): ScriptSign | null {
  return SCRIPT_SIGN_KEYS.find((key) => key === value) ?? null;
}

/** Stellen-Zeichen: `quote` hält den Text davor, die Stelle folgt direkt darauf. */
function locateSignPoint(
  parts: ScriptPart[],
  anchor: {
    partIndex: number | null;
    start: number | null;
    quote: string | null;
    suffix?: string | null;
  },
): { partIndex: number; start: number; end: number } | null {
  if (anchor.partIndex === null) return null;
  const same = parts[anchor.partIndex];
  const at = same ? locatePoint(same.text, anchor.start, anchor.quote, anchor.suffix) : null;
  if (at !== null) return { partIndex: anchor.partIndex, start: at, end: at };
  for (const [index, part] of parts.entries()) {
    const found = locatePoint(part.text, null, anchor.quote, anchor.suffix);
    if (found !== null && anchor.quote) return { partIndex: index, start: found, end: found };
  }
  return null;
}

type StoredAnnotation = Awaited<ReturnType<typeof loadOwnAnnotations>>[number];

async function loadOwnAnnotations(showId: string, authorId: string) {
  return prisma.scriptAnnotation.findMany({
    where: { showId, authorId },
    orderBy: { createdAt: "asc" },
  });
}

/** Status je Notiz für eine Fassung (reine Funktion, testbar). */
export function resolveAnnotations(
  annotations: StoredAnnotation[],
  versionId: string,
  blocks: { id: string; lineageId: string; parts: ScriptPart[] }[],
): ReaderAnnotation[] {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const byLineage = new Map(blocks.map((block) => [block.lineageId, block]));
  // Rückfall ohne gemeinsame Kennung (z. B. Entwurf vor der Freigabe): identischer Wortlaut.
  const byText = new Map<string, (typeof blocks)[number]>();
  for (const block of blocks) {
    const key = plainBlockText(block.parts);
    if (!byText.has(key)) byText.set(key, block);
  }
  return annotations.map((annotation) => {
    const block =
      (annotation.versionId === versionId && annotation.blockId
        ? byId.get(annotation.blockId)
        : undefined) ??
      byLineage.get(annotation.lineageId) ??
      byText.get(annotation.blockText);
    let state: AnnotationState = "orphaned";
    let anchor = {
      partIndex: annotation.partIndex,
      start: annotation.start,
      end: annotation.end,
    };
    if (block) {
      const unchanged =
        annotation.versionId === versionId || plainBlockText(block.parts) === annotation.blockText;
      const sign = signOf(annotation.sign);
      const located = isPointAnchor(annotation)
        ? locateSignPoint(block.parts, annotation)
        : locateQuote(block.parts, annotation);
      if (annotation.partIndex !== null) {
        if (located) anchor = located;
        // Alles an einer Textstelle wandert still mit, solange die Wörter selbst noch da sind
        // (docs/Plan/skript-notizen-plan.md, Schritt 5).
        state = located ? "ok" : "changed";
      } else {
        state =
          unchanged ||
          similarity(plainBlockText(block.parts), annotation.blockText) >= BLOCK_NOTE_SIMILARITY
            ? "ok"
            : "changed";
      }
    }
    return {
      id: annotation.id,
      kind: annotation.kind,
      strokes: readSketch(annotation.ink),
      color: ANNOTATION_COLORS.find((color) => color === annotation.color) ?? null,
      sign: signOf(annotation.sign),
      body: annotation.body,
      ...anchor,
      quote: annotation.quote,
      blockId: block?.id ?? null,
      state,
      previousText: annotation.blockText,
      createdAt: annotation.createdAt.toISOString(),
      updatedAt: annotation.updatedAt.toISOString(),
    };
  });
}

export async function loadReaderAnnotations(
  showId: string,
  versionId: string,
  authorId: string,
  blocks: { id: string; lineageId: string; parts: ScriptPart[] }[],
) {
  return resolveAnnotations(await loadOwnAnnotations(showId, authorId), versionId, blocks);
}

async function loadBlock(versionId: string, blockId: string) {
  const block = await prisma.scriptBlock.findFirst({
    where: { id: blockId, versionId },
    select: {
      id: true,
      lineageId: true,
      parts: true,
      version: { select: { showId: true } },
    },
  });
  if (!block) throw new ScriptAnnotationError("Absatz nicht gefunden.");
  return { ...block, parts: readParts(block.parts) };
}

export async function createAnnotation(authorId: string, raw: AnnotationInput) {
  const input = annotationInputSchema.parse(raw);
  const block = await loadBlock(input.versionId, input.blockId);
  let quote: string | null = null;
  let context: { prefix: string; suffix: string } | null = null;
  if (input.partIndex !== null && input.start !== null && input.end !== null) {
    const part = block.parts[input.partIndex];
    if (!part || input.end > part.text.length) {
      throw new ScriptAnnotationError("Ungültige Textstelle.");
    }
    quote = isPointSign(input.sign)
      ? pointContext(part.text, input.start)
      : part.text.slice(input.start, input.end);
    context = rangeContext(part.text, input.start, input.end);
  }
  const hasRange = quote !== null && (quote !== "" || isPointSign(input.sign));
  return prisma.scriptAnnotation.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      showId: block.version.showId,
      versionId: input.versionId,
      blockId: block.id,
      lineageId: block.lineageId,
      kind: input.kind,
      color: input.kind === "highlight" ? (input.color ?? "gelb") : null,
      sign: input.kind === "sign" ? input.sign : null,
      body: input.body || null,
      partIndex: hasRange ? input.partIndex : null,
      start: hasRange ? input.start : null,
      end: hasRange ? input.end : null,
      quote,
      prefix: hasRange ? (context?.prefix ?? null) : null,
      suffix: hasRange ? (context?.suffix ?? null) : null,
      blockText: plainBlockText(block.parts),
      authorId,
    },
  });
}

/** Neue Notiz anlegen und so zurückgeben, wie der Leser sie anzeigt (ohne Neuladen). */
export async function createReaderAnnotation(authorId: string, raw: AnnotationInput) {
  const created = await createAnnotation(authorId, raw);
  const block = await loadBlock(created.versionId, created.blockId ?? "");
  const [annotation] = resolveAnnotations([created], created.versionId, [block]);
  return annotation;
}

async function requireOwn(annotationId: string, authorId: string) {
  const annotation = await prisma.scriptAnnotation.findUnique({
    where: { id: annotationId },
    select: { id: true, authorId: true, showId: true, kind: true },
  });
  if (!annotation || annotation.authorId !== authorId) {
    throw new ScriptAnnotationError("Notiz nicht gefunden.");
  }
  return annotation;
}

export async function updateAnnotation(
  annotationId: string,
  authorId: string,
  patch: { body?: string | null; color?: AnnotationColor | null },
) {
  const annotation = await requireOwn(annotationId, authorId);
  const body = patch.body === undefined ? undefined : patch.body?.trim() || null;
  if (annotation.kind === "note" && body === null) {
    throw new ScriptAnnotationError("Die Notiz ist leer.");
  }
  return prisma.scriptAnnotation.update({
    where: { id: annotationId },
    data: { body, color: patch.color ?? undefined },
    select: { id: true, showId: true },
  });
}

/**
 * Notiz einem Absatz der gelesenen Fassung zuordnen bzw. dort bestätigen („Passt so“).
 * Ist die markierte Stelle nicht mehr da, gilt die Notiz danach für den ganzen Absatz.
 */
export async function anchorAnnotation(
  annotationId: string,
  authorId: string,
  versionId: string,
  blockId: string,
) {
  await requireOwn(annotationId, authorId);
  const [annotation, block] = await Promise.all([
    prisma.scriptAnnotation.findUniqueOrThrow({ where: { id: annotationId } }),
    loadBlock(versionId, blockId),
  ]);
  if (block.version.showId !== annotation.showId) {
    throw new ScriptAnnotationError("Absatz gehört zu einem anderen Stück.");
  }
  const point = isPointAnchor(annotation);
  const located = point
    ? locateSignPoint(block.parts, annotation)
    : locateQuote(block.parts, annotation);
  // Zeichen ohne Stelle gibt es nicht – lieber nachfragen lassen als falsch platzieren.
  if (annotation.kind === "sign" && !located) {
    throw new ScriptAnnotationError("Die Stelle fehlt in diesem Absatz – bitte neu setzen.");
  }
  return prisma.scriptAnnotation.update({
    where: { id: annotationId },
    data: {
      versionId,
      blockId: block.id,
      lineageId: block.lineageId,
      blockText: plainBlockText(block.parts),
      partIndex: located?.partIndex ?? null,
      start: located?.start ?? null,
      end: located?.end ?? null,
      quote: located
        ? point
          ? pointContext(block.parts[located.partIndex].text, located.start)
          : annotation.quote
        : null,
      ...(located
        ? rangeContext(block.parts[located.partIndex].text, located.start, located.end)
        : { prefix: null, suffix: null }),
    },
    select: { id: true, showId: true },
  });
}

export async function deleteAnnotation(annotationId: string, authorId: string) {
  const annotation = await requireOwn(annotationId, authorId);
  await prisma.scriptAnnotation.delete({ where: { id: annotationId } });
  return annotation;
}

/** Stück und Status einer Fassung – für die Rechteprüfung der Notiz-Aktionen. */
export async function scriptVersionScope(versionId: string) {
  return prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { showId: true, status: true },
  });
}

export const sketchInputSchema = z.object({
  /** Vom Leser vergebene Kennung (neu) bzw. vorhandener Zettel. */
  id: z.string().min(1),
  versionId: z.string().min(1),
  blockId: z.string().min(1),
  /** Stelle im Teil, an der der Zettel hängt; ohne = ganzer Absatz. */
  partIndex: z.number().int().min(0).nullable().default(null),
  at: z.number().int().min(0).nullable().default(null),
  title: z.string().trim().max(200).nullable().default(null),
  strokes: z.array(inkStrokeSchema).max(500),
});
export type SketchInput = z.input<typeof sketchInputSchema>;

/**
 * Notizzettel speichern (docs/Plan/skript-notizen-plan.md, Schritt 6): feste Zeichenfläche,
 * an einer Stelle im Text verankert. Leerer Zettel = löschen. Gibt den Zettel so zurück, wie der
 * Leser ihn zeigt (oder null, wenn er gelöscht wurde).
 */
export async function saveSketch(authorId: string, raw: SketchInput) {
  const input = sketchInputSchema.parse(raw);
  const existing = await prisma.scriptAnnotation.findUnique({
    where: { id: input.id },
    select: { id: true, authorId: true, kind: true },
  });
  if (existing) {
    if (existing.authorId !== authorId || existing.kind !== "ink") {
      throw new ScriptAnnotationError("Zettel nicht gefunden.");
    }
    if (!input.strokes.length) {
      await prisma.scriptAnnotation.delete({ where: { id: input.id } });
      return null;
    }
    const updated = await prisma.scriptAnnotation.update({
      where: { id: input.id },
      data: { ink: { canvas: true, strokes: input.strokes }, body: input.title || null },
    });
    const block = updated.blockId ? await loadBlock(updated.versionId, updated.blockId) : null;
    return block ? resolveAnnotations([updated], updated.versionId, [block])[0] : null;
  }
  if (!input.strokes.length) return null;
  const block = await loadBlock(input.versionId, input.blockId);
  const text = input.partIndex !== null ? block.parts[input.partIndex]?.text : undefined;
  const anchored = text !== undefined && input.at !== null && input.at <= text.length;
  const created = await prisma.scriptAnnotation.create({
    data: {
      id: input.id,
      showId: block.version.showId,
      versionId: input.versionId,
      blockId: block.id,
      lineageId: block.lineageId,
      kind: "ink",
      ink: { canvas: true, strokes: input.strokes },
      body: input.title || null,
      partIndex: anchored ? input.partIndex : null,
      start: anchored ? input.at : null,
      end: anchored ? input.at : null,
      quote: anchored && input.at !== null ? pointContext(text, input.at) : null,
      ...(anchored && input.at !== null
        ? rangeContext(text, input.at, input.at)
        : { prefix: null, suffix: null }),
      blockText: plainBlockText(block.parts),
      authorId,
    },
  });
  return resolveAnnotations([created], created.versionId, [block])[0];
}
