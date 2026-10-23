import { prisma } from "@/lib/prisma";

import { buildAxis } from "./live/axis";
import { buildProtocol, type Protocol } from "./live/protocol";
import type { ScriptReaderData } from "./reader";
import { closeStaleSessions, eventsAround } from "./sessions";
import { isSpoken } from "./types";

/** Protokolle der Aufnahmen einer Fassung (docs/Plan/skript-mitlesen-plan.md, E10–E12). */

export type SessionListItem = {
  id: string;
  kind: "group" | "private";
  status: "recording" | "draft" | "confirmed" | "discarded";
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  samples: number;
  event: { id: string; title: string; start: string } | null;
};

export async function listSessions(versionId: string, userId: string, canManage: boolean) {
  await closeStaleSessions({ versionId });
  const sessions = await prisma.scriptSession.findMany({
    where: {
      versionId,
      OR: [
        { kind: "private", ownerId: userId },
        canManage
          ? { kind: "group", status: { not: "discarded" } }
          : { kind: "group", status: "confirmed" },
      ],
    },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      status: true,
      title: true,
      startedAt: true,
      endedAt: true,
      event: { select: { id: true, title: true, start: true } },
      _count: { select: { samples: true } },
    },
  });
  return sessions.map((session): SessionListItem => ({
    id: session.id,
    kind: session.kind,
    status: session.status,
    title: session.title,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    samples: session._count.samples,
    event: session.event ? { ...session.event, start: session.event.start.toISOString() } : null,
  }));
}

/** Sprechende Rollen je Szene (Grundlage für „Rolle fehlte“). */
export function sceneRoles(data: Pick<ScriptReaderData, "blocks">) {
  const map: Record<string, Set<string>> = {};
  for (const block of data.blocks) {
    if (!isSpoken(block.kind)) continue;
    const set = (map[block.sceneId] ??= new Set());
    for (const roleId of block.roleIds) set.add(roleId);
  }
  return Object.fromEntries(Object.entries(map).map(([id, set]) => [id, [...set]]));
}

export type SessionDetail = {
  session: SessionListItem & { note: string | null; ownerName: string | null; own: boolean };
  protocol: Protocol | null;
  /** Termine des Stücks rund um die Aufnahme (zum Verknüpfen). */
  events: { id: string; title: string; start: string; cancelled: boolean }[];
  /** Private Spuren anderer zählen nicht; die eigene Spur in dieser gemeinsamen Aufnahme. */
  ownTrackId: string | null;
};

export async function loadSessionDetail(
  sessionId: string,
  data: ScriptReaderData,
  userId: string,
  canManage: boolean,
): Promise<SessionDetail | null> {
  const session = await prisma.scriptSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      versionId: true,
      kind: true,
      status: true,
      title: true,
      note: true,
      ownerId: true,
      startedAt: true,
      endedAt: true,
      owner: { select: { name: true } },
      event: { select: { id: true, title: true, start: true } },
      samples: {
        orderBy: { at: "asc" },
        select: { at: true, pos: true, active: true, roleIds: true },
      },
      tracks: { where: { ownerId: userId }, select: { id: true }, take: 1 },
    },
  });
  if (!session || session.versionId !== data.version.id) return null;
  if (session.kind === "private" && session.ownerId !== userId) return null;
  if (session.kind === "group" && !canManage && session.status !== "confirmed") return null;
  if (session.kind === "group" && session.status === "discarded" && !canManage) return null;

  const protocol = buildProtocol({
    samples: session.samples.map((sample) => ({
      at: sample.at.getTime(),
      pos: sample.pos,
      active: sample.active,
      roleIds: sample.roleIds,
    })),
    axis: buildAxis(data.blocks),
    blockScenes: data.blocks.map((block) => block.sceneId),
    scenes: data.scenes.map((scene) => ({ id: scene.id, title: scene.title })),
    sceneRoles: session.kind === "group" ? sceneRoles(data) : undefined,
  });
  const events =
    session.kind === "group" && canManage
      ? await eventsAround(data.version.showId, session.startedAt)
      : [];
  return {
    session: {
      id: session.id,
      kind: session.kind,
      status: session.status,
      title: session.title,
      note: session.note,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      samples: session.samples.length,
      event: session.event ? { ...session.event, start: session.event.start.toISOString() } : null,
      ownerName: session.owner.name ?? null,
      own: session.ownerId === userId,
    },
    protocol,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      cancelled: event.status === "CANCELLED",
    })),
    ownTrackId: session.tracks[0]?.id ?? null,
  };
}
