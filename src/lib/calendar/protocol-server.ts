import type { Prisma } from "@prisma/client";

import { loadAudienceContext } from "@/lib/calendar/audience-server";
import {
  CALENDAR_PLANNER_PERMISSION,
  REHEARSAL_PROTOCOL_PERMISSION,
} from "@/lib/calendar/permissions";
import type {
  AssigneeOption,
  ProtocolCandidate,
  ProtocolNote,
  ProtocolOp,
  ProtocolState,
  TaskAssignee,
} from "@/lib/calendar/protocol";
import { blockLabel } from "@/lib/calendar/scene-schedule";
import { getUserDisplayName } from "@/lib/names";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
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
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!event) return null;

  const context = await loadAudienceContext(event.showId);
  const state: ProtocolState = {
    actualStart: iso(event.actualStart),
    actualEnd: iso(event.actualEnd),
    summary: event.protocolSummary ?? "",
    notes: event.notes.map(toProtocolNote),
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
  const assignees = buildAssigneeOptions(context);

  return { event, state, candidates, scenes, assignees };
}

type NoteRow = {
  id: string;
  type: ProtocolNote["type"];
  text: string;
  blockId: string | null;
  assigneeUserId: string | null;
  characterId: string | null;
  departmentId: string | null;
  dueAt: Date | null;
  doneAt: Date | null;
  createdAt: Date;
};

export function toProtocolNote(note: NoteRow): ProtocolNote {
  const assignee: TaskAssignee | null = note.assigneeUserId
    ? { kind: "user", id: note.assigneeUserId }
    : note.characterId
      ? { kind: "character", id: note.characterId }
      : note.departmentId
        ? { kind: "department", id: note.departmentId }
        : null;
  return {
    id: note.id,
    type: note.type,
    text: note.text,
    blockId: note.blockId,
    assignee,
    dueAt: note.dueAt ? note.dueAt.toISOString().slice(0, 10) : null,
    doneAt: iso(note.doneAt),
    createdAt: note.createdAt.toISOString(),
  };
}

/** Wer eine Aufgabe bekommen kann: Gewerke, Figuren (mit Besetzung) und Personen. */
export function buildAssigneeOptions(
  context: Awaited<ReturnType<typeof loadAudienceContext>>,
): AssigneeOption[] {
  const memberName = new Map(context.members.map((member) => [member.id, member.name]));
  return [
    ...context.departments.map((department) => ({
      kind: "department" as const,
      id: department.id,
      label: `Gewerk ${department.name}`,
    })),
    ...context.characters.map((character) => {
      const cast = context.castings
        .filter((casting) => casting.characterId === character.id)
        .map((casting) => memberName.get(casting.userId))
        .filter(Boolean);
      return {
        kind: "character" as const,
        id: character.id,
        label: cast.length ? `${character.name} (${cast.join(", ")})` : character.name,
      };
    }),
    ...context.members
      .map((member) => ({ kind: "user" as const, id: member.id, label: member.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "de")),
  ];
}

/**
 * Wendet Operationen aus dem Probenmodus der Reihe nach auf die Datenbank an. Eine fehlerhafte
 * Operation (z. B. gelöschte Person) wird verworfen, statt die übrigen zu blockieren – sonst
 * bliebe sie in der Warteschlange des Geräts für immer hängen.
 */
export async function applyProtocolOpsToDb(
  eventId: string,
  ops: readonly ProtocolOp[],
  authorId: string,
) {
  let rejected = 0;
  const newTasks: string[] = [];
  for (const op of ops) {
    try {
      const created = await prisma.$transaction((tx) => applyOne(tx, eventId, op, authorId));
      if (created) newTasks.push(created);
    } catch (error) {
      rejected += 1;
      console.error("[protocol] Operation verworfen", op.type, error);
    }
  }
  await notifyNewTasks(eventId, newTasks, authorId).catch((error) =>
    console.error("[protocol] Aufgaben-Benachrichtigung fehlgeschlagen", error),
  );
  return { rejected };
}

/** Wer eine Aufgabe erledigen soll: die Person, die Besetzung der Figur oder die Gewerk-Leitung. */
export async function resolveTaskRecipients(note: {
  assigneeUserId: string | null;
  characterId: string | null;
  departmentId: string | null;
}) {
  if (note.assigneeUserId) return [note.assigneeUserId];
  if (note.characterId) {
    const castings = await prisma.characterCasting.findMany({
      where: { characterId: note.characterId },
      select: { userId: true },
    });
    return castings.map((casting) => casting.userId);
  }
  if (note.departmentId) {
    const leads = await prisma.departmentMembership.findMany({
      where: {
        departmentId: note.departmentId,
        status: "active",
        role: { in: ["lead", "deputy"] },
      },
      select: { userId: true },
    });
    return leads.map((lead) => lead.userId);
  }
  return [];
}

async function notifyNewTasks(eventId: string, noteIds: string[], authorId: string) {
  if (!noteIds.length) return;
  const notes = await prisma.eventNote.findMany({
    where: { id: { in: noteIds } },
    include: { event: { select: { title: true, showId: true } } },
  });
  for (const note of notes) {
    await notify({
      type: NOTIFICATION_TYPES.REHEARSAL_TASK,
      recipients: await resolveTaskRecipients(note),
      actorId: authorId,
      title: `Neue Aufgabe aus „${note.event.title}“`,
      body: note.text,
      eventId,
      showId: note.event.showId,
      actionUrl: "/mitglieder#aufgaben",
    });
  }
}

/** Erste Spalte des Gewerk-Boards (dort landen Aufgaben aus der Probe). */
async function firstBoardColumn(tx: Prisma.TransactionClient, departmentId: string) {
  return tx.departmentBoardColumn.findFirst({
    where: { departmentId },
    orderBy: { position: "asc" },
    select: { id: true, status: true },
  });
}

/** Gibt die ID einer neu angelegten Aufgabe zurück (für die Benachrichtigung). */
async function applyOne(
  tx: Prisma.TransactionClient,
  eventId: string,
  op: ProtocolOp,
  authorId: string,
): Promise<string | null> {
  const at = "at" in op && op.at ? new Date(op.at) : null;
  switch (op.type) {
    case "event-time":
      await tx.calendarEvent.update({
        where: { id: eventId },
        data: op.field === "start" ? { actualStart: at } : { actualEnd: at },
      });
      return null;
    case "block-start":
      await tx.eventBlock.updateMany({
        where: { id: op.blockId, eventId },
        data: at ? { actualStart: at } : { actualStart: null, actualEnd: null },
      });
      return null;
    case "block-finish":
      await tx.eventBlock.updateMany({
        where: { id: op.blockId, eventId },
        data: { actualEnd: at, outcome: op.outcome },
      });
      return null;
    case "block-note":
      await tx.eventBlock.updateMany({
        where: { id: op.blockId, eventId },
        data: { note: op.note.trim() || null },
      });
      return null;
    case "block-order":
      for (const [index, blockId] of op.blockIds.entries()) {
        await tx.eventBlock.updateMany({
          where: { id: blockId, eventId },
          data: { actualOrder: index },
        });
      }
      return null;
    case "block-add": {
      const exists = await tx.eventBlock.findFirst({
        where: op.sceneId
          ? { eventId, OR: [{ id: op.blockId }, { sceneId: op.sceneId }] }
          : { id: op.blockId },
        select: { id: true },
      });
      if (exists) return null;
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
      return null;
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
      return null;
    }
    case "guest-add":
      await tx.eventGuest.upsert({
        where: { id: op.guestId },
        update: {},
        create: { id: op.guestId, eventId, name: op.name },
      });
      return null;
    case "guest-remove":
      await tx.eventGuest.deleteMany({ where: { id: op.guestId, eventId } });
      return null;
    case "note-add": {
      if (await tx.eventNote.findUnique({ where: { id: op.noteId }, select: { id: true } })) {
        return null;
      }
      const task = op.noteType === "TASK";
      const assignee = task ? op.assignee : null;
      const dueAt = task && op.dueAt ? new Date(`${op.dueAt}T12:00:00`) : null;
      let departmentTaskId: string | null = null;
      if (assignee?.kind === "department") {
        const column = await firstBoardColumn(tx, assignee.id);
        const last = column
          ? await tx.departmentTask.aggregate({
              where: { columnId: column.id },
              _max: { position: true },
            })
          : null;
        const event = await tx.calendarEvent.findUnique({
          where: { id: eventId },
          select: { title: true },
        });
        const card = await tx.departmentTask.create({
          data: {
            departmentId: assignee.id,
            columnId: column?.id ?? null,
            status: column?.status ?? "todo",
            position: (last?._max.position ?? -1) + 1,
            title: op.text.slice(0, 160),
            description: `Aus der Probe „${event?.title ?? "Probe"}“.`,
            dueAt,
            createdById: authorId,
          },
          select: { id: true },
        });
        departmentTaskId = card.id;
      }
      await tx.eventNote.create({
        data: {
          id: op.noteId,
          eventId,
          blockId: op.blockId,
          type: op.noteType,
          text: op.text,
          authorId,
          assigneeUserId: assignee?.kind === "user" ? assignee.id : null,
          characterId: assignee?.kind === "character" ? assignee.id : null,
          departmentId: assignee?.kind === "department" ? assignee.id : null,
          departmentTaskId,
          dueAt,
        },
      });
      return task ? op.noteId : null;
    }
    case "note-edit":
      await tx.eventNote.updateMany({ where: { id: op.noteId, eventId }, data: { text: op.text } });
      return null;
    case "note-remove": {
      const note = await tx.eventNote.findFirst({
        where: { id: op.noteId, eventId },
        select: { departmentTaskId: true },
      });
      if (!note) return null;
      await tx.eventNote.delete({ where: { id: op.noteId } });
      if (note.departmentTaskId) {
        await tx.departmentTask.deleteMany({ where: { id: note.departmentTaskId } });
      }
      return null;
    }
    case "summary":
      await tx.calendarEvent.update({
        where: { id: eventId },
        data: { protocolSummary: op.text.trim() || null },
      });
      return null;
  }
}
