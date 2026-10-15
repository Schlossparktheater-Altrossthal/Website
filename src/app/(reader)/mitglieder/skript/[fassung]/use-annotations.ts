"use client";

import * as React from "react";
import { toast } from "sonner";

import type { AnnotationColor, ReaderAnnotation, ScriptSign } from "@/lib/skript/annotation-types";

import { createAnnotationAction, deleteAnnotationAction, updateAnnotationAction } from "../actions";

/**
 * Eigene Markierungen und Notizen im Leser (docs/Plan/skript-notizen-plan.md, Schritt 1):
 * Änderungen erscheinen sofort und werden im Hintergrund gespeichert – ohne die ganze Seite
 * neu zu laden. Jede Änderung lässt sich rückgängig machen.
 */

export type AnnotationDraft = {
  blockId: string;
  kind: "highlight" | "note" | "sign";
  color?: AnnotationColor | null;
  sign?: ScriptSign | null;
  body?: string | null;
  /** Textstelle im Absatz; ohne = ganzer Absatz. */
  range?: { partIndex: number; start: number; end: number; quote: string } | null;
};

type Patch = { body?: string | null; color?: AnnotationColor | null };

type UndoStep =
  | { type: "created"; ref: { id: string } }
  | { type: "deleted"; annotation: ReaderAnnotation }
  | { type: "updated"; ref: { id: string }; before: Patch };

function draftOf(annotation: ReaderAnnotation): AnnotationDraft | null {
  if (!annotation.blockId || annotation.kind === "ink") return null;
  return {
    blockId: annotation.blockId,
    kind: annotation.kind,
    color: annotation.color,
    sign: annotation.sign,
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
  /** Laufende Anlagen: Ändern/Löschen wartet, bis die Notiz auf dem Server existiert. */
  const pending = React.useRef(new Map<string, Promise<boolean>>());
  // Server-Stand (z. B. nach Zuordnen oder Freihand) übernehmen, laufende Anlagen behalten.
  const [seen, setSeen] = React.useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setList((current) => [
      ...initial.filter((annotation) => !deleting.current.has(annotation.id)),
      ...current.filter(
        (annotation) =>
          pending.current.has(annotation.id) &&
          !initial.some((entry) => entry.id === annotation.id),
      ),
    ]);
  }
  const undoStack = React.useRef<UndoStep[]>([]);
  const [canUndo, setCanUndo] = React.useState(false);
  const push = (step: UndoStep) => {
    undoStack.current = [...undoStack.current.slice(-49), step];
    setCanUndo(true);
  };

  const failed = (error: string) => toast.error("Das hat nicht geklappt", { description: error });

  /** Anlegen: sofort sichtbar, Speichern im Hintergrund. */
  const create = React.useCallback(
    async (draft: AnnotationDraft, record = true) => {
      // Kennung entsteht hier und gilt auch auf dem Server – Antippen klappt schon vor dem Speichern.
      const ref = { id: crypto.randomUUID() };
      const now = new Date().toISOString();
      const temp: ReaderAnnotation = {
        id: ref.id,
        kind: draft.kind,
        strokes: [],
        color: draft.kind === "highlight" ? (draft.color ?? "gelb") : null,
        sign: draft.sign ?? null,
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
      const saving = createAnnotationAction({
        id: ref.id,
        versionId,
        blockId: draft.blockId,
        kind: draft.kind,
        color: draft.color ?? null,
        sign: draft.sign ?? null,
        body: draft.body ?? null,
        ...(draft.range
          ? { partIndex: draft.range.partIndex, start: draft.range.start, end: draft.range.end }
          : {}),
      }).then((result) => {
        pending.current.delete(ref.id);
        if (!result.ok) {
          setList((current) => current.filter((entry) => entry.id !== ref.id));
          failed(result.error);
          return false;
        }
        // Inzwischen gelöscht: nicht wieder einsetzen.
        if (!deleting.current.has(ref.id)) {
          setList((current) =>
            current.map((entry) => (entry.id === ref.id ? result.annotation : entry)),
          );
        }
        return true;
      });
      pending.current.set(ref.id, saving);
      return (await saving) ? ref : null;
    },
    [versionId],
  );

  const remove = React.useCallback(
    async (annotation: ReaderAnnotation, record = true) => {
      deleting.current.add(annotation.id);
      setList((current) => current.filter((entry) => entry.id !== annotation.id));
      if (record) push({ type: "deleted", annotation });
      // Noch nicht gespeichert: erst abwarten; ging das Anlegen schief, gibt es nichts zu löschen.
      const saving = pending.current.get(annotation.id);
      if (saving && !(await saving)) {
        deleting.current.delete(annotation.id);
        return true;
      }
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
      await pending.current.get(annotation.id);
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
