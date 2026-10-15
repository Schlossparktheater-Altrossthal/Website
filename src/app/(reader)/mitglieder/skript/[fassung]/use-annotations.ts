"use client";

import * as React from "react";
import { toast } from "sonner";

import type {
  AnnotationColor,
  InkStroke,
  ReaderAnnotation,
  ScriptSign,
} from "@/lib/skript/annotation-types";

import {
  createAnnotationAction,
  deleteAnnotationAction,
  saveSketchAction,
  updateAnnotationAction,
} from "../actions";
import { applyOutbox, isOffline, readOutbox, writeOutbox, type OutboxOp } from "./outbox";

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
  const queue = useOutbox(versionId, setList);
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
      const input = {
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
      };
      const saving = queue
        .send({ type: "create", input, annotation: temp }, () => createAnnotationAction(input))
        .then((result) => {
          pending.current.delete(ref.id);
          if (result === "queued") return true;
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
      const result = await queue.send({ type: "delete", id: annotation.id }, () =>
        deleteAnnotationAction(versionId, annotation.id),
      );
      deleting.current.delete(annotation.id);
      if (result !== "queued" && !result.ok) {
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
      const result = await queue.send({ type: "update", id: annotation.id, patch }, () =>
        updateAnnotationAction(versionId, annotation.id, patch),
      );
      if (result !== "queued" && !result.ok) {
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

  /**
   * Notizzettel anlegen oder ändern (leer = löschen). `existing` ist der bisherige Zettel; neue
   * bekommen hier ihre Kennung, die auch auf dem Server gilt.
   */
  const saveSketch = React.useCallback(
    async (draft: {
      existing: ReaderAnnotation | null;
      blockId: string;
      partIndex: number | null;
      at: number | null;
      title: string | null;
      strokes: InkStroke[];
    }) => {
      const id = draft.existing?.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const before = draft.existing;
      const next: ReaderAnnotation = {
        ...(before ?? {
          id,
          kind: "ink" as const,
          sign: null,
          color: null,
          partIndex: draft.partIndex,
          start: draft.at,
          end: draft.at,
          quote: null,
          blockId: draft.blockId,
          state: "ok" as const,
          previousText: "",
          createdAt: now,
        }),
        strokes: draft.strokes,
        body: draft.title,
        updatedAt: now,
      };
      setList((current) =>
        draft.strokes.length
          ? before
            ? current.map((entry) => (entry.id === id ? next : entry))
            : [...current, next]
          : current.filter((entry) => entry.id !== id),
      );
      const input = {
        id,
        versionId,
        blockId: draft.blockId,
        partIndex: draft.partIndex,
        at: draft.at,
        title: draft.title,
        strokes: draft.strokes,
      };
      const result = await queue.send(
        { type: "sketch", input, annotation: draft.strokes.length ? next : null },
        () => saveSketchAction(input),
      );
      if (result === "queued") return;
      if (!result.ok) {
        setList((current) => [
          ...current.filter((entry) => entry.id !== id),
          ...(before ? [before] : []),
        ]);
        failed(result.error);
        return;
      }
      const saved = result.annotation;
      if (saved) setList((current) => current.map((entry) => (entry.id === id ? saved : entry)));
    },
    [versionId],
  );

  return {
    list,
    create,
    remove,
    removeWithUndo,
    update,
    undo,
    canUndo,
    saveSketch,
    waiting: queue.waiting,
  };
}

type Sent = { ok: boolean; error?: string; annotation?: ReaderAnnotation | null };

/**
 * Ohne Netz: Änderung in die Warteschlange (Schritt 7) und als gespeichert behandeln. Solange
 * etwas wartet, geht auch jede neue Änderung hinten an – sonst überholt sie ältere.
 */
function useOutbox(
  versionId: string,
  setList: React.Dispatch<React.SetStateAction<ReaderAnnotation[]>>,
) {
  const [waiting, setWaiting] = React.useState(0);
  const flushing = React.useRef(false);

  const enqueue = React.useCallback(
    (op: OutboxOp) => {
      const ops = [...readOutbox(versionId), op];
      writeOutbox(versionId, ops);
      setWaiting(ops.length);
    },
    [versionId],
  );

  const flush = React.useCallback(async () => {
    if (flushing.current || isOffline()) return;
    flushing.current = true;
    try {
      let ops = readOutbox(versionId);
      while (ops.length) {
        const op = ops[0];
        let result: Sent;
        try {
          result = await runOp(versionId, op);
        } catch (error) {
          if (isOffline(error)) break;
          result = { ok: false, error: "Das hat nicht geklappt." };
        }
        if (!result.ok) {
          toast.error("Eine Notiz von unterwegs ließ sich nicht speichern", {
            description: result.error,
          });
        } else if (op.type === "create" && result.annotation) {
          const saved = result.annotation;
          setList((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
        }
        // Neu lesen: während des Sendens kann etwas dazugekommen sein.
        ops = readOutbox(versionId).slice(1);
        writeOutbox(versionId, ops);
        setWaiting(ops.length);
      }
    } finally {
      flushing.current = false;
    }
  }, [versionId, setList]);

  // Beim Öffnen: Wartendes über den (evtl. aus dem Cache geladenen) Stand legen und nachsenden.
  React.useEffect(() => {
    const ops = readOutbox(versionId);
    setWaiting(ops.length);
    if (ops.length) setList((current) => applyOutbox(current, ops));
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [versionId, flush, setList]);

  const send = React.useCallback(
    async <T extends Sent>(op: OutboxOp, call: () => Promise<T>): Promise<T | "queued"> => {
      if (readOutbox(versionId).length || isOffline()) {
        enqueue(op);
        void flush();
        return "queued";
      }
      try {
        return await call();
      } catch (error) {
        if (!isOffline(error)) throw error;
        enqueue(op);
        return "queued";
      }
    },
    [versionId, enqueue, flush],
  );

  return { send, waiting };
}

function runOp(versionId: string, op: OutboxOp): Promise<Sent> {
  switch (op.type) {
    case "create":
      return createAnnotationAction(op.input);
    case "update":
      return updateAnnotationAction(versionId, op.id, op.patch);
    case "delete":
      return deleteAnnotationAction(versionId, op.id);
    case "sketch":
      return saveSketchAction(op.input);
  }
}

export type AnnotationStore = ReturnType<typeof useAnnotations>;
