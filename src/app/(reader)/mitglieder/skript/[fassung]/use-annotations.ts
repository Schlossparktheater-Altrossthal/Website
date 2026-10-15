"use client";

import * as React from "react";
import { toast } from "sonner";

import type { AnnotationColor, ReaderAnnotation } from "@/lib/skript/annotation-types";

import { createAnnotationAction, deleteAnnotationAction, updateAnnotationAction } from "../actions";

/**
 * Eigene Markierungen und Notizen im Leser (docs/Plan/skript-notizen-plan.md, Schritt 1):
 * Änderungen erscheinen sofort und werden im Hintergrund gespeichert – ohne die ganze Seite
 * neu zu laden. Jede Änderung lässt sich rückgängig machen.
 */

export type AnnotationDraft = {
  blockId: string;
  kind: "highlight" | "note";
  color?: AnnotationColor | null;
  body?: string | null;
  /** Textstelle im Absatz; ohne = ganzer Absatz. */
  range?: { partIndex: number; start: number; end: number; quote: string } | null;
};

type Patch = { body?: string | null; color?: AnnotationColor | null };

type UndoStep =
  | { type: "created"; ref: { id: string } }
  | { type: "deleted"; annotation: ReaderAnnotation }
  | { type: "updated"; ref: { id: string }; before: Patch };

const isTemp = (id: string) => id.startsWith("tmp:");

function draftOf(annotation: ReaderAnnotation): AnnotationDraft | null {
  if (!annotation.blockId || annotation.kind === "ink") return null;
  return {
    blockId: annotation.blockId,
    kind: annotation.kind,
    color: annotation.color,
    body: annotation.body,
    range:
      annotation.partIndex !== null && annotation.start !== null && annotation.end !== null
        ? {
            partIndex: annotation.partIndex,
            start: annotation.start,
            end: annotation.end,
            quote: annotation.quote ?? "",
          }
        : null,
  };
}

export function useAnnotations(versionId: string, initial: ReaderAnnotation[]) {
  const [list, setList] = React.useState(initial);
  const deleting = React.useRef(new Set<string>());
  // Server-Stand (z. B. nach Zuordnen oder Freihand) übernehmen, laufende Anlagen behalten.
  const [seen, setSeen] = React.useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setList((current) => [
      ...initial.filter((annotation) => !deleting.current.has(annotation.id)),
      ...current.filter((annotation) => isTemp(annotation.id)),
    ]);
  }
  const undoStack = React.useRef<UndoStep[]>([]);
  const [canUndo, setCanUndo] = React.useState(false);
  const push = (step: UndoStep) => {
    undoStack.current = [...undoStack.current.slice(-49), step];
    setCanUndo(true);
  };

  const failed = (error: string) => toast.error("Das hat nicht geklappt", { description: error });

  /** Anlegen; liefert eine Referenz, deren `id` nach dem Speichern die echte ist. */
  const create = React.useCallback(
    async (draft: AnnotationDraft, record = true) => {
      const ref = { id: `tmp:${crypto.randomUUID()}` };
      const now = new Date().toISOString();
      const temp: ReaderAnnotation = {
        id: ref.id,
        kind: draft.kind,
        strokes: [],
        color: draft.kind === "highlight" ? (draft.color ?? "gelb") : null,
        body: draft.body ?? null,
        partIndex: draft.range?.partIndex ?? null,
        start: draft.range?.start ?? null,
        end: draft.range?.end ?? null,
        quote: draft.range?.quote ?? null,
        blockId: draft.blockId,
        state: "ok",
        previousText: "",
        createdAt: now,
        updatedAt: now,
      };
      setList((current) => [...current, temp]);
      if (record) push({ type: "created", ref });
      const result = await createAnnotationAction({
        versionId,
        blockId: draft.blockId,
        kind: draft.kind,
        color: draft.color ?? null,
        body: draft.body ?? null,
        ...(draft.range
          ? { partIndex: draft.range.partIndex, start: draft.range.start, end: draft.range.end }
          : {}),
      });
      if (!result.ok) {
        setList((current) => current.filter((entry) => entry.id !== temp.id));
        failed(result.error);
        return null;
      }
      ref.id = result.annotation.id;
      // Schon vor dem Speichern wieder entfernt (Rückgängig): auch auf dem Server löschen.
      if (deleting.current.delete(temp.id)) {
        void deleteAnnotationAction(versionId, result.annotation.id);
        return null;
      }
      setList((current) =>
        current.map((entry) => (entry.id === temp.id ? result.annotation : entry)),
      );
      return ref;
    },
    [versionId],
  );

  const remove = React.useCallback(
    async (annotation: ReaderAnnotation, record = true) => {
      deleting.current.add(annotation.id);
      setList((current) => current.filter((entry) => entry.id !== annotation.id));
      if (record) push({ type: "deleted", annotation });
      // Noch nicht gespeichert: `create` löscht nach dem Speichern selbst.
      if (isTemp(annotation.id)) return true;
      const result = await deleteAnnotationAction(versionId, annotation.id);
      deleting.current.delete(annotation.id);
      if (!result.ok) {
        setList((current) => [...current, annotation]);
        failed(result.error);
        return false;
      }
      return true;
    },
    [versionId],
  );

  const update = React.useCallback(
    async (annotation: ReaderAnnotation, patch: Patch, record = true) => {
      const before: Patch = {
        ...("body" in patch ? { body: annotation.body } : {}),
        ...("color" in patch ? { color: annotation.color } : {}),
      };
      const apply = (values: Patch) =>
        setList((current) =>
          current.map((entry) => (entry.id === annotation.id ? { ...entry, ...values } : entry)),
        );
      apply(patch);
      if (record) push({ type: "updated", ref: { id: annotation.id }, before });
      const result = await updateAnnotationAction(versionId, annotation.id, patch);
      if (!result.ok) {
        apply(before);
        failed(result.error);
        return false;
      }
      return true;
    },
    [versionId],
  );

  const listRef = React.useRef(list);
  React.useEffect(() => {
    listRef.current = list;
  }, [list]);
  const undo = React.useCallback(async () => {
    const step = undoStack.current.at(-1);
    if (!step) return;
    undoStack.current = undoStack.current.slice(0, -1);
    setCanUndo(undoStack.current.length > 0);
    const find = (id: string) => listRef.current.find((entry) => entry.id === id);
    if (step.type === "created") {
      const annotation = find(step.ref.id);
      if (annotation) await remove(annotation, false);
    } else if (step.type === "deleted") {
      const draft = draftOf(step.annotation);
      if (draft) await create(draft, false);
    } else {
      const annotation = find(step.ref.id);
      if (annotation) await update(annotation, step.before, false);
    }
  }, [create, remove, update]);

  /** Löschen mit „Rückgängig“ im Hinweis statt Rückfrage. */
  const removeWithUndo = React.useCallback(
    async (annotation: ReaderAnnotation) => {
      if (!(await remove(annotation))) return;
      toast(annotation.kind === "note" ? "Notiz entfernt" : "Markierung entfernt", {
        action: { label: "Rückgängig", onClick: () => void undo() },
      });
    },
    [remove, undo],
  );

  return { list, create, remove, removeWithUndo, update, undo, canUndo };
}

export type AnnotationStore = ReturnType<typeof useAnnotations>;
