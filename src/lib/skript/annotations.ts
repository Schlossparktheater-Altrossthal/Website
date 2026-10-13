import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { readParts } from "./json";
import {
  ANNOTATION_COLORS,
  ScriptAnnotationError,
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
    versionId: z.string().min(1),
    blockId: z.string().min(1),
    kind: z.enum(["highlight", "note"]),
    color: z.enum(ANNOTATION_COLORS).nullable().default(null),
    body: z.string().trim().max(4000).nullable().default(null),
    partIndex: z.number().int().min(0).nullable().default(null),
    start: z.number().int().min(0).nullable().default(null),
    end: z.number().int().min(0).nullable().default(null),
  })
  .refine((value) => value.kind !== "note" || !!value.body, {
    message: "Die Notiz ist leer.",
  })
  .refine(
    (value) =>
      value.partIndex === null ||
      (value.start !== null && value.end !== null && value.end > value.start),
    { message: "Ungültige Textstelle." },
  );

export type AnnotationInput = z.input<typeof annotationInputSchema>;

/** Wortlaut eines Absatzes, wie er für Vergleiche gespeichert wird. */
export function plainBlockText(parts: ScriptPart[]) {
  return parts
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Liegt die markierte Stelle noch so im Absatz? Sonst wird sie gesucht. */
export function locateQuote(
  parts: ScriptPart[],
  anchor: {
    partIndex: number | null;
    start: number | null;
    end: number | null;
    quote: string | null;
  },
): { partIndex: number; start: number; end: number } | null {
  if (anchor.partIndex === null || !anchor.quote) return null;
  const { partIndex, start, end, quote } = anchor;
  if (start !== null && end !== null && parts[partIndex]?.text.slice(start, end) === quote) {
    return { partIndex, start, end };
  }
  for (const [index, part] of parts.entries()) {
    const found = part.text.indexOf(quote);
    if (found >= 0) return { partIndex: index, start: found, end: found + quote.length };
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
  return annotations.map((annotation) => {
    const block =
      (annotation.versionId === versionId && annotation.blockId
        ? byId.get(annotation.blockId)
        : undefined) ?? byLineage.get(annotation.lineageId);
    let state: AnnotationState = "orphaned";
    let anchor = {
      partIndex: annotation.partIndex,
      start: annotation.start,
      end: annotation.end,
    };
    if (block) {
      const unchanged =
        annotation.versionId === versionId || plainBlockText(block.parts) === annotation.blockText;
      const located = locateQuote(block.parts, annotation);
      if (annotation.partIndex !== null) {
        if (located) anchor = located;
        // Marker wandern mit, solange die Stelle noch da ist; Notizen fragen bei jeder
        // Änderung am Absatz nach, weil sich ihr Sinn ändern kann.
        state = located && (unchanged || annotation.kind === "highlight") ? "ok" : "changed";
      } else {
        state = unchanged ? "ok" : "changed";
      }
    }
    return {
      id: annotation.id,
      kind: annotation.kind,
      color: ANNOTATION_COLORS.find((color) => color === annotation.color) ?? null,
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
  if (input.partIndex !== null && input.start !== null && input.end !== null) {
    const part = block.parts[input.partIndex];
    if (!part || input.end > part.text.length) {
      throw new ScriptAnnotationError("Ungültige Textstelle.");
    }
    quote = part.text.slice(input.start, input.end);
  }
  return prisma.scriptAnnotation.create({
    data: {
      showId: block.version.showId,
      versionId: input.versionId,
      blockId: block.id,
      lineageId: block.lineageId,
      kind: input.kind,
      color: input.kind === "highlight" ? (input.color ?? "gelb") : null,
      body: input.body || null,
      partIndex: quote ? input.partIndex : null,
      start: quote ? input.start : null,
      end: quote ? input.end : null,
      quote,
      blockText: plainBlockText(block.parts),
      authorId,
    },
    select: { id: true, showId: true },
  });
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
  const located = locateQuote(block.parts, annotation);
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
      quote: located ? annotation.quote : null,
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
