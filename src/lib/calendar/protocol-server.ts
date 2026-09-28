import type { Prisma } from "@prisma/client";

import { loadAudienceContext } from "@/lib/calendar/audience-server";
import {
  CALENDAR_PLANNER_PERMISSION,
  REHEARSAL_PROTOCOL_PERMISSION,
} from "@/lib/calendar/permissions";
import type { ProtocolCandidate, ProtocolOp, ProtocolState } from "@/lib/calendar/protocol";
import { blockLabel } from "@/lib/calendar/scene-schedule";
import { getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type PermissionUser = Parameters<typeof hasPermission>[0];

/** Protokoll führen darf die Planung und wer das Protokoll-Recht (für die Produktion) hat. */
export async function canEditProtocol(user: PermissionUser, showId: string | null) {
  const scope = showId ? { showId } : undefined;
  const [planner, protocol] = await Promise.all([
    hasPermission(user, CALENDAR_PLANNER_PERMISSION, scope),
    hasPermission(user, REHEARSAL_PROTOCOL_PERMISSION, scope),
  ]);
  return planner || protocol;
}

const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;

/** Aktueller Stand des Probenmodus eines Termins samt Auswahllisten. */
export async function readProtocol(eventId: string) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      blocks: {
        orderBy: [
          { actualOrder: { sort: "asc", nulls: "last" } },
          { startsAt: { sort: "asc", nulls: "last" } },
          { order: "asc" },
        ],
        include: {
          scene: { select: { identifier: true, sequence: true, title: true } },
          department: { select: { name: true } },
        },
      },
      participants: {
        where: { OR: [{ invited: true }, { attendance: { not: null } }] },
        include: { user: { select: { firstName: true, lastName: true, name: true, email: true } } },
      },
      guests: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
    },
  });
  if (!event) return null;

  const context = await loadAudienceContext(event.showId);
  const state: ProtocolState = {
    actualStart: iso(event.actualStart),
    actualEnd: iso(event.actualEnd),
    blocks: event.blocks
      .filter((block) => block.type !== "SCENE" || block.scene)
      .map((block) => ({
        id: block.id,
        label: blockLabel({ ...block, location: null }),
        kind: block.type,
        sceneId: block.sceneId,
        plannedStart: iso(block.startsAt),
        plannedEnd: iso(block.endsAt),
        location: block.location,
        actualStart: iso(block.actualStart),
        actualEnd: iso(block.actualEnd),
        outcome: block.outcome,
        note: block.note ?? "",
        unplanned: block.unplanned,
      })),
    people: event.participants
      .map((entry) => {
        const declined = entry.response === "no" || entry.response === "emergency";
        const reasons = Array.isArray(entry.reasons)
          ? entry.reasons.filter((reason): reason is string => typeof reason === "string")
          : [];
        return {
          userId: entry.userId,
          name: getUserDisplayName(entry.user),
          detail: entry.invited ? reasons.join(" · ") : "dazugekommen",
          invited: entry.invited,
          declined,
          // Wer abgesagt hat, gilt ohne Erfassung als entschuldigt.
          mark: entry.attendance ?? (declined ? ("EXCUSED" as const) : null),
          at: iso(entry.arrivedAt ?? entry.leftAt),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    guests: event.guests,
  };

  const present = new Set(state.people.map((person) => person.userId));
  const candidates: ProtocolCandidate[] = context.members
    .filter((member) => !present.has(member.id))
    .map((member) => ({ userId: member.id, name: member.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const scenes = context.scenes.map((scene) => ({ id: scene.id, label: scene.label }));

  return { event, state, candidates, scenes };
}

/**
 * Wendet Operationen aus dem Probenmodus der Reihe nach auf die Datenbank an. Eine fehlerhafte
 * Operation (z. B. gelöschte Person) wird verworfen, statt die übrigen zu blockieren – sonst
 * bliebe sie in der Warteschlange des Geräts für immer hängen.
 */
export async function applyProtocolOpsToDb(eventId: string, ops: readonly ProtocolOp[]) {
  let rejected = 0;
  for (const op of ops) {
    try {
      await prisma.$transaction((tx) => applyOne(tx, eventId, op));
    } catch (error) {
      rejected += 1;
      console.error("[protocol] Operation verworfen", op.type, error);
    }
  }
  return { rejected };
}

async function applyOne(tx: Prisma.TransactionClient, eventId: string, op: ProtocolOp) {
  const at = "at" in op && op.at ? new Date(op.at) : null;
  switch (op.type) {
    case "event-time":
      await tx.calendarEvent.update({
        where: { id: eventId },
        data: op.field === "start" ? { actualStart: at } : { actualEnd: at },
      });
      return;
    case "block-start":
      await tx.eventBlock.updateMany({
        where: { id: op.blockId, eventId },
        data: at ? { actualStart: at } : { actualStart: null, actualEnd: null },
      });
      return;
    case "block-finish":
      await tx.eventBlock.updateMany({
        where: { id: op.blockId, eventId },
        data: { actualEnd: at, outcome: op.outcome },
      });
      return;
    case "block-note":
      await tx.eventBlock.updateMany({
        where: { id: op.blockId, eventId },
        data: { note: op.note.trim() || null },
      });
      return;
    case "block-order":
      for (const [index, blockId] of op.blockIds.entries()) {
        await tx.eventBlock.updateMany({
          where: { id: blockId, eventId },
          data: { actualOrder: index },
        });
      }
      return;
    case "block-add": {
      const exists = await tx.eventBlock.findFirst({
        where: op.sceneId
          ? { eventId, OR: [{ id: op.blockId }, { sceneId: op.sceneId }] }
          : { id: op.blockId },
        select: { id: true },
      });
      if (exists) return;
      const last = await tx.eventBlock.aggregate({ where: { eventId }, _max: { order: true } });
      await tx.eventBlock.create({
        data: {
          id: op.blockId,
          eventId,
          type: op.sceneId ? "SCENE" : "CUSTOM",
          sceneId: op.sceneId,
          title: op.sceneId ? null : op.title,
          order: (last._max.order ?? 0) + 1,
          unplanned: true,
        },
      });
      return;
    }
    case "attendance": {
      const times = {
        arrivedAt: op.mark === "LATE" ? at : null,
        leftAt: op.mark === "LEFT_EARLY" ? at : null,
      };
      await tx.eventParticipant.upsert({
        where: { eventId_userId: { eventId, userId: op.userId } },
        update: { attendance: op.mark, ...times },
        create: { eventId, userId: op.userId, invited: false, attendance: op.mark, ...times },
      });
      return;
    }
    case "guest-add":
      await tx.eventGuest.upsert({
        where: { id: op.guestId },
        update: {},
        create: { id: op.guestId, eventId, name: op.name },
      });
      return;
    case "guest-remove":
      await tx.eventGuest.deleteMany({ where: { id: op.guestId, eventId } });
      return;
  }
}
