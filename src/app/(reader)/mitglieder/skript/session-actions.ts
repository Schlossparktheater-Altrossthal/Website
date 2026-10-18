"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  MAX_UPLOAD_SAMPLES,
  ScriptSessionError,
  appendPrivateSamples,
  startGroupSession,
  startPrivateSession,
  stopSession,
  versionAccess,
} from "@/lib/skript/sessions";

/**
 * Aufnahmen beim Mitlesen (docs/Plan/skript-mitlesen-plan.md, E10–E12): gemeinsame nur mit
 * Skript-Verwaltung, private für alle Lesenden (nur der Besitzer sieht und ändert sie).
 */

export type SessionActionResult =
  | { ok: true; sessionId?: string; startedAt?: number; message?: string }
  | { ok: false; error: string };

async function run(
  task: () => Promise<Omit<Extract<SessionActionResult, { ok: true }>, "ok"> | void>,
): Promise<SessionActionResult> {
  try {
    return { ok: true, ...((await task()) ?? {}) };
  } catch (error) {
    if (error instanceof ScriptSessionError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Ungültige Eingabe." };
    }
    console.error("[skript] Aufnahme-Aktion fehlgeschlagen", error);
    return { ok: false, error: "Das hat nicht geklappt." };
  }
}

async function requireUser() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) throw new ScriptSessionError("Nicht angemeldet.");
  return { user: session.user, userId };
}

const versionSchema = z.object({ versionId: z.string().min(1).max(64) });
const sessionSchema = z.object({ sessionId: z.string().min(1).max(64) });

/** Laden der Aufnahme mit Rechteprüfung: privat nur Besitzer, gemeinsam nur Verwaltung. */
async function requireOwnSession(sessionId: string) {
  const { user, userId } = await requireUser();
  const session = await prisma.scriptSession.findUnique({
    where: { id: sessionId },
    select: { id: true, kind: true, status: true, ownerId: true, versionId: true },
  });
  if (!session) throw new ScriptSessionError("Aufnahme nicht gefunden.");
  const access = await versionAccess(user, session.versionId);
  const allowed = session.kind === "private" ? session.ownerId === userId : !!access?.canManage;
  if (!allowed) throw new ScriptSessionError("Keine Berechtigung.");
  return { session, userId, showId: access?.version.showId ?? null };
}

function revalidate(versionId: string) {
  revalidatePath(`/mitglieder/skript/${versionId}/protokolle`, "layout");
}

export async function startGroupRecordingAction(input: unknown) {
  return run(async () => {
    const { user, userId } = await requireUser();
    const { versionId } = versionSchema.parse(input);
    const access = await versionAccess(user, versionId);
    if (!access?.canManage)
      throw new ScriptSessionError("Nur die Skript-Verwaltung kann aufnehmen.");
    const session = await startGroupSession({
      versionId,
      showId: access.version.showId,
      ownerId: userId,
    });
    revalidate(versionId);
    return { sessionId: session.id, startedAt: session.startedAt.getTime() };
  });
}

export async function startPrivateRecordingAction(input: unknown) {
  return run(async () => {
    const { user, userId } = await requireUser();
    const { versionId } = versionSchema.parse(input);
    if (!(await versionAccess(user, versionId)))
      throw new ScriptSessionError("Keine Berechtigung.");
    const session = await startPrivateSession({ versionId, ownerId: userId });
    revalidate(versionId);
    return { sessionId: session.id, startedAt: session.startedAt.getTime() };
  });
}

const samplesSchema = sessionSchema.extend({
  samples: z
    .array(
      z.object({
        at: z.number().int().positive(),
        pos: z.number().min(0).max(1e8),
        active: z.number().int().min(0).max(1),
      }),
    )
    .max(MAX_UPLOAD_SAMPLES),
});

export async function uploadPrivateSamplesAction(input: unknown) {
  return run(async () => {
    const { userId } = await requireUser();
    const { sessionId, samples } = samplesSchema.parse(input);
    await appendPrivateSamples(sessionId, userId, samples);
  });
}

export async function stopRecordingAction(input: unknown) {
  return run(async () => {
    const { sessionId } = sessionSchema.parse(input);
    const { session } = await requireOwnSession(sessionId);
    await stopSession(session.id);
    revalidate(session.versionId);
    return { sessionId: session.id };
  });
}

const updateSchema = sessionSchema.extend({
  title: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  eventId: z.string().min(1).max(64).nullable().optional(),
});

export async function updateSessionAction(input: unknown) {
  return run(async () => {
    const { sessionId, title, note, eventId } = updateSchema.parse(input);
    const { session, showId } = await requireOwnSession(sessionId);
    if (eventId !== undefined && eventId !== null) {
      if (session.kind !== "group") throw new ScriptSessionError("Nur gemeinsame Aufnahmen.");
      const event = await prisma.calendarEvent.findUnique({
        where: { id: eventId },
        select: { showId: true },
      });
      if (!event || event.showId !== showId) throw new ScriptSessionError("Termin nicht gefunden.");
    }
    await prisma.scriptSession.update({
      where: { id: session.id },
      data: {
        ...(title !== undefined ? { title: title || null } : {}),
        ...(note !== undefined ? { note: note || null } : {}),
        ...(eventId !== undefined ? { eventId } : {}),
      },
    });
    revalidate(session.versionId);
    return { message: "Gespeichert" };
  });
}

/** Gemeinsame Aufnahme bestätigen (danach sichtbar für alle Lesenden und am Termin). */
export async function confirmSessionAction(input: unknown) {
  return run(async () => {
    const { sessionId } = sessionSchema.parse(input);
    const { session, userId } = await requireOwnSession(sessionId);
    if (session.kind !== "group") throw new ScriptSessionError("Nur gemeinsame Aufnahmen.");
    if (session.status === "recording") await stopSession(session.id);
    await prisma.scriptSession.update({
      where: { id: session.id },
      data: { status: "confirmed", confirmedAt: new Date(), confirmedById: userId },
    });
    revalidate(session.versionId);
    return { message: "Protokoll bestätigt" };
  });
}

/** Gemeinsam: verwerfen (bleibt als „verworfen“, Messpunkte weg); privat: ganz löschen. */
export async function discardSessionAction(input: unknown) {
  return run(async () => {
    const { sessionId } = sessionSchema.parse(input);
    const { session } = await requireOwnSession(sessionId);
    if (session.kind === "private") {
      await prisma.scriptSession.delete({ where: { id: session.id } });
    } else {
      await prisma.$transaction([
        prisma.scriptSessionSample.deleteMany({ where: { sessionId: session.id } }),
        prisma.scriptSession.update({
          where: { id: session.id },
          data: { status: "discarded", endedAt: new Date(), confirmedAt: null },
        }),
      ]);
    }
    revalidate(session.versionId);
    return { message: session.kind === "private" ? "Aufnahme gelöscht" : "Protokoll verworfen" };
  });
}
