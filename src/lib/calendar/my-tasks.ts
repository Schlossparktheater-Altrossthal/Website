import { prisma } from "@/lib/prisma";

export type MyTask = {
  id: string;
  text: string;
  eventId: string;
  eventTitle: string;
  eventStart: string;
  dueAt: string | null;
  doneAt: string | null;
  /** Über welche Figur die Aufgabe kommt; `null` bei persönlicher Zuweisung. */
  via: string | null;
};

const DONE_VISIBLE_DAYS = 7;

/**
 * Aufgaben aus Probenprotokollen für eine Person: direkt zugewiesen oder über eine Figur, die
 * sie spielt. Gewerk-Aufgaben stehen im Gewerk-Board. Erledigte bleiben eine Woche sichtbar.
 */
export async function readMyTasks(userId: string, now = new Date()): Promise<MyTask[]> {
  const castings = await prisma.characterCasting.findMany({
    where: { userId },
    select: { characterId: true },
  });
  const characterIds = castings.map((casting) => casting.characterId);
  const notes = await prisma.eventNote.findMany({
    where: {
      type: "TASK",
      OR: [
        { assigneeUserId: userId },
        ...(characterIds.length ? [{ characterId: { in: characterIds } }] : []),
      ],
      AND: [
        {
          OR: [
            { doneAt: null },
            { doneAt: { gte: new Date(now.getTime() - DONE_VISIBLE_DAYS * 86_400_000) } },
          ],
        },
      ],
    },
    orderBy: [
      { doneAt: { sort: "asc", nulls: "first" } },
      { dueAt: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    take: 50,
    include: {
      event: { select: { id: true, title: true, start: true } },
      character: { select: { name: true } },
    },
  });
  return notes.map((note) => ({
    id: note.id,
    text: note.text,
    eventId: note.event.id,
    eventTitle: note.event.title,
    eventStart: note.event.start.toISOString(),
    dueAt: note.dueAt ? note.dueAt.toISOString().slice(0, 10) : null,
    doneAt: note.doneAt?.toISOString() ?? null,
    via: note.character ? note.character.name : null,
  }));
}
