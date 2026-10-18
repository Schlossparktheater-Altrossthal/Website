import type { ScriptSessionKind, ScriptSessionStatus } from "@prisma/client";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "./service";

/**
 * Aufnahmen beim Mitlesen (docs/Plan/skript-mitlesen-plan.md, E10–E12). Gemeinsame startet die
 * Führung (Skript-Verwaltung), Messpunkte schreibt der Realtime-Server. Private zeichnet der Leser
 * selbst auf; sie sieht nur der Besitzer.
 */

export class ScriptSessionError extends Error {}

/** Ohne Messpunkt seit so langer Zeit gilt eine Aufnahme als beendet (vergessen). */
export const STALE_MS = 30 * 60_000;
/** Höchstens so lange läuft eine Aufnahme. */
export const MAX_SESSION_MS = 4 * 3600_000;
/** Höchstens so viele Messpunkte je Upload (privat, alle 5 s → ~40 min). */
export const MAX_UPLOAD_SAMPLES = 500;

type SessionUser = Parameters<typeof hasPermission>[0];

export async function versionAccess(user: SessionUser, versionId: string) {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { id: true, showId: true, status: true, label: true },
  });
  if (!version) return null;
  const scope = { showId: version.showId };
  const [canRead, canManage] = await Promise.all([
    hasPermission(user, SCRIPT_READ_PERMISSION, scope),
    hasPermission(user, SCRIPT_MANAGE_PERMISSION, scope),
  ]);
  // Entwürfe sehen nur Verwalter (wie im Leser).
  const allowed = canManage || (canRead && version.status === "released");
  return allowed ? { version, canManage } : null;
}

/** Darf diese Person die Aufnahme sehen? Privat nur Besitzer; gemeinsam Verwalter, bestätigt alle Lesenden. */
export function canSeeSession(
  session: { kind: ScriptSessionKind; status: ScriptSessionStatus; ownerId: string },
  userId: string,
  canManage: boolean,
) {
  if (session.kind === "private") return session.ownerId === userId;
  if (canManage) return true;
  return session.status === "confirmed";
}

/** Laufender Termin des Stücks zur Zeit `at` (Vorschlag für die Verknüpfung, E2). */
export async function suggestEvent(showId: string, at: Date) {
  const early = new Date(at.getTime() + 60 * 60_000);
  const events = await prisma.calendarEvent.findMany({
    where: {
      showId,
      status: { not: "CANCELLED" },
      start: { lte: early, gte: new Date(at.getTime() - 12 * 3600_000) },
    },
    orderBy: { start: "desc" },
    select: { id: true, start: true, end: true },
    take: 10,
  });
  const running = events.find(
    (event) => !event.end || event.end.getTime() + 30 * 60_000 >= at.getTime(),
  );
  return running?.id ?? null;
}

/** Termine des Stücks rund um eine Aufnahme (Auswahl beim Verknüpfen). */
export function eventsAround(showId: string, at: Date) {
  return prisma.calendarEvent.findMany({
    where: {
      showId,
      start: {
        gte: new Date(at.getTime() - 3 * 86_400_000),
        lte: new Date(at.getTime() + 86_400_000),
      },
    },
    orderBy: { start: "asc" },
    select: { id: true, title: true, start: true, end: true, status: true },
    take: 30,
  });
}

/**
 * Vergessene Aufnahmen beenden: ohne Messpunkt seit 30 min oder länger als 4 h. Ende = letzter
 * Messpunkt (sonst Start).
 */
export async function closeStaleSessions(where: { versionId?: string; ownerId?: string }) {
  const now = Date.now();
  const open = await prisma.scriptSession.findMany({
    where: { ...where, status: "recording" },
    select: {
      id: true,
      startedAt: true,
      samples: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
    },
  });
  for (const session of open) {
    const last = session.samples[0]?.at ?? session.startedAt;
    const tooLong = now - session.startedAt.getTime() > MAX_SESSION_MS;
    if (!tooLong && now - last.getTime() < STALE_MS) continue;
    await prisma.scriptSession.updateMany({
      where: { id: session.id, status: "recording" },
      data: { status: "draft", endedAt: last },
    });
  }
}

export async function startGroupSession(input: {
  versionId: string;
  showId: string;
  ownerId: string;
}) {
  await closeStaleSessions({ versionId: input.versionId });
  const running = await prisma.scriptSession.findFirst({
    where: { versionId: input.versionId, kind: "group", status: "recording" },
    select: { id: true, startedAt: true },
  });
  if (running) return running;
  const now = new Date();
  return prisma.scriptSession.create({
    data: {
      versionId: input.versionId,
      kind: "group",
      ownerId: input.ownerId,
      startedAt: now,
      eventId: await suggestEvent(input.showId, now),
    },
    select: { id: true, startedAt: true },
  });
}

export async function startPrivateSession(input: { versionId: string; ownerId: string }) {
  await closeStaleSessions({ ownerId: input.ownerId });
  const running = await prisma.scriptSession.findFirst({
    where: {
      versionId: input.versionId,
      ownerId: input.ownerId,
      kind: "private",
      status: "recording",
    },
    select: { id: true, startedAt: true },
  });
  if (running) return running;
  // Läuft gerade eine gemeinsame Aufnahme, ist die private eine Spur davon.
  const group = await prisma.scriptSession.findFirst({
    where: { versionId: input.versionId, kind: "group", status: "recording" },
    select: { id: true },
  });
  return prisma.scriptSession.create({
    data: {
      versionId: input.versionId,
      kind: "private",
      ownerId: input.ownerId,
      groupSessionId: group?.id ?? null,
    },
    select: { id: true, startedAt: true },
  });
}

export type UploadSample = { at: number; pos: number; active: number };

/** Messpunkte einer privaten Aufnahme speichern (doppelte Zeitpunkte werden übersprungen). */
export async function appendPrivateSamples(
  sessionId: string,
  ownerId: string,
  samples: UploadSample[],
) {
  const session = await prisma.scriptSession.findUnique({
    where: { id: sessionId },
    select: { ownerId: true, kind: true, status: true, startedAt: true, endedAt: true },
  });
  if (!session || session.kind !== "private" || session.ownerId !== ownerId) {
    throw new ScriptSessionError("Aufnahme nicht gefunden.");
  }
  if (session.status === "discarded") return 0;
  const from = session.startedAt.getTime() - 60_000;
  const to = Math.min(Date.now() + 60_000, from + MAX_SESSION_MS + 120_000);
  const valid = samples.filter((sample) => sample.at >= from && sample.at <= to);
  if (!valid.length) return 0;
  const result = await prisma.scriptSessionSample.createMany({
    data: valid.map((sample) => ({
      sessionId,
      at: new Date(sample.at),
      pos: sample.pos,
      active: sample.active,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function stopSession(sessionId: string) {
  const last = await prisma.scriptSessionSample.findFirst({
    where: { sessionId },
    orderBy: { at: "desc" },
    select: { at: true },
  });
  await prisma.scriptSession.updateMany({
    where: { id: sessionId, status: "recording" },
    data: { status: "draft", endedAt: last?.at ?? new Date() },
  });
}
