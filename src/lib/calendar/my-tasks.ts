import { prisma } from "@/lib/prisma";

export type MyTask = {
  id: string;
  text: string;
  eventId: string;
  eventTitle: string;
  eventStart: string;
  dueAt: string | null;
  /** Mein Teil erledigt (bei mehreren Zuständigen: nur meiner). */
  doneAt: string | null;
  /** Über welche Figur die Aufgabe kommt; `null` bei persönlicher Zuweisung. */
  via: string | null;
  /** Weitere Zuständige und wie viele davon noch offen sind. */
  others: number;
  othersOpen: number;
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
  const rows = await prisma.eventNoteAssignee.findMany({
    where: {
      note: { type: "TASK" },
      OR: [{ userId }, ...(characterIds.length ? [{ characterId: { in: characterIds } }] : [])],
      AND: [
        {
          OR: [
            { doneAt: null },
            { doneAt: { gte: new Date(now.getTime() - DONE_VISIBLE_DAYS * 86_400_000) } },
          ],
        },
      ],
    },
    take: 100,
    include: {
      character: { select: { name: true } },
      note: {
        include: {
          event: { select: { id: true, title: true, start: true } },
          assignees: { select: { id: true, doneAt: true } },
        },
      },
    },
  });

  const byNote = new Map<string, typeof rows>();
  for (const row of rows) byNote.set(row.noteId, [...(byNote.get(row.noteId) ?? []), row]);

  const tasks = [...byNote.values()].map((mine): MyTask => {
    const { note } = mine[0];
    const mineIds = new Set(mine.map((row) => row.id));
    const others = note.assignees.filter((row) => !mineIds.has(row.id));
    const myDone = mine.every((row) => row.doneAt)
      ? mine
          .map((row) => row.doneAt!.toISOString())
          .sort()
          .at(-1)!
      : null;
    return {
      id: note.id,
      text: note.text,
      eventId: note.event.id,
      eventTitle: note.event.title,
      eventStart: note.event.start.toISOString(),
      dueAt: note.dueAt ? note.dueAt.toISOString().slice(0, 10) : null,
      doneAt: myDone,
      via: mine.find((row) => row.userId === userId) ? null : (mine[0].character?.name ?? null),
      others: others.length,
      othersOpen: others.filter((row) => !row.doneAt).length,
    };
  });
  return tasks
    .sort(
      (a, b) =>
        Number(!!a.doneAt) - Number(!!b.doneAt) ||
        (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") ||
        a.eventStart.localeCompare(b.eventStart),
    )
    .slice(0, 50);
}
