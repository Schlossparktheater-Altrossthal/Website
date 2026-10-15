import type { ReaderAnnotation } from "@/lib/skript/annotation-types";

// Nur Typen – wird beim Bauen entfernt, zieht also kein Prisma in den Client.
import type { AnnotationInput, SketchInput } from "@/lib/skript/annotations";

/**
 * Warteschlange für Notizen ohne Netz (docs/Plan/skript-notizen-plan.md, Schritt 7): Änderungen
 * landen im localStorage und werden in derselben Reihenfolge nachgesendet, sobald wieder Netz da
 * ist. Anlegen und Löschen sind auf dem Server wiederholbar (gleiche Kennung).
 */
export type OutboxOp =
  | { type: "create"; input: AnnotationInput; annotation: ReaderAnnotation }
  | {
      type: "update";
      id: string;
      patch: { body?: string | null; color?: ReaderAnnotation["color"] };
    }
  | { type: "delete"; id: string }
  | { type: "sketch"; input: SketchInput; annotation: ReaderAnnotation | null };

const key = (versionId: string) => `skript-outbox:${versionId}`;

export function readOutbox(versionId: string): OutboxOp[] {
  try {
    const raw = window.localStorage.getItem(key(versionId));
    return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

export function writeOutbox(versionId: string, ops: OutboxOp[]) {
  try {
    if (ops.length) window.localStorage.setItem(key(versionId), JSON.stringify(ops));
    else window.localStorage.removeItem(key(versionId));
  } catch {
    // Speicher voll oder gesperrt – dann bleibt es beim Fehlerhinweis.
  }
}

/** Wartende Änderungen über den (evtl. veralteten, aus dem Cache geladenen) Stand legen. */
export function applyOutbox(list: ReaderAnnotation[], ops: OutboxOp[]): ReaderAnnotation[] {
  let result = list;
  for (const op of ops) {
    if (op.type === "create") {
      if (!result.some((entry) => entry.id === op.annotation.id))
        result = [...result, op.annotation];
    } else if (op.type === "update") {
      result = result.map((entry) => (entry.id === op.id ? { ...entry, ...op.patch } : entry));
    } else if (op.type === "delete") {
      result = result.filter((entry) => entry.id !== op.id);
    } else {
      const next = op.annotation;
      result = result.filter((entry) => entry.id !== op.input.id);
      if (next) result = [...result, next];
    }
  }
  return result;
}

/** Netzfehler (Anfrage kam nicht an) – im Gegensatz zu einer Ablehnung durch den Server. */
export function isOffline(error?: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError;
}
