import type { AudienceContext } from "@/lib/calendar/audience";
import type { MyTask } from "@/lib/calendar/my-tasks";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_MARKS,
  type AttendanceMarkValue,
} from "@/lib/calendar/protocol";
import {
  buildAssigneeOptions,
  resolveTaskRecipients,
  toProtocolNote,
} from "@/lib/calendar/protocol-server";
import { blockLabel } from "@/lib/calendar/scene-schedule";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

export type ProtocolView = {
  summary: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  sentAt: string | null;
  /** Je Anwesenheitsstatus die Namen (mit Uhrzeit bei verspätet/früher weg). */
  attendance: { mark: AttendanceMarkValue; label: string; names: string[] }[];
  guests: string[];
  blocks: {
    id: string;
    label: string;
    outcome: "DONE" | "PARTIAL" | "SKIPPED" | null;
    actualStart: string | null;
    actualEnd: string | null;
    note: string | null;
    unplanned: boolean;
  }[];
  decisions: { id: string; text: string; block: string | null }[];
  notes: { id: string; text: string; block: string | null }[];
  tasks: (MyTask & { assignee: string | null; mine: boolean })[];
};

const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Protokoll einer Probe zum Lesen; `null`, solange nichts erfasst ist. */
export async function readProtocolView(
  eventId: string,
  userId: string,
  context: AudienceContext | null,
): Promise<ProtocolView | null> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      start: true,
      actualStart: true,
      actualEnd: true,
      protocolSummary: true,
      protocolSentAt: true,
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
        where: { attendance: { not: null } },
        include: { user: { select: { firstName: true, lastName: true, name: true, email: true } } },
      },
      guests: { orderBy: { createdAt: "asc" }, select: { name: true } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!event) return null;
  const hasContent =
    event.actualStart ||
    event.protocolSummary ||
    event.participants.length ||
    event.notes.length ||
    event.blocks.some((block) => block.outcome || block.actualStart || block.note);
  if (!hasContent) return null;

  const labels = new Map(
    event.blocks.map((block) => [block.id, blockLabel({ ...block, location: null })]),
  );
  const options = context ? buildAssigneeOptions(context) : [];
  const assigneeLabel = (note: ReturnType<typeof toProtocolNote>) =>
    note.assignee
      ? (options.find(
          (option) => option.kind === note.assignee?.kind && option.id === note.assignee?.id,
        )?.label ?? null)
      : null;

  const taskRows = event.notes.filter((note) => note.type === "TASK");
  const tasks = await Promise.all(
    taskRows.map(async (row) => {
      const note = toProtocolNote(row);
      const mine = (await resolveTaskRecipients(row)).includes(userId);
      return {
        id: note.id,
        text: note.text,
        eventId: event.id,
        eventTitle: event.title,
        eventStart: event.start.toISOString(),
        dueAt: note.dueAt,
        doneAt: note.doneAt,
        via: null,
        assignee: assigneeLabel(note),
        mine,
      };
    }),
  );

  return {
    summary: event.protocolSummary,
    actualStart: event.actualStart?.toISOString() ?? null,
    actualEnd: event.actualEnd?.toISOString() ?? null,
    sentAt: event.protocolSentAt?.toISOString() ?? null,
    attendance: ATTENDANCE_MARKS.map((mark) => ({
      mark,
      label: ATTENDANCE_LABELS[mark],
      names: event.participants
        .filter((entry) => entry.attendance === mark)
        .map((entry) => {
          const at = entry.arrivedAt ?? entry.leftAt;
          const name = getUserDisplayName(entry.user);
          return at
            ? `${name} (${TIME.format(at)})`
            : entry.invited
              ? name
              : `${name}, dazugekommen`;
        })
        .sort((a, b) => a.localeCompare(b, "de")),
    })).filter((entry) => entry.names.length),
    guests: event.guests.map((guest) => guest.name),
    blocks: event.blocks
      .filter((block) => block.type !== "SCENE" || block.scene)
      .map((block) => ({
        id: block.id,
        label: labels.get(block.id) ?? "Punkt",
        outcome: block.outcome,
        actualStart: block.actualStart?.toISOString() ?? null,
        actualEnd: block.actualEnd?.toISOString() ?? null,
        note: block.note,
        unplanned: block.unplanned,
      })),
    decisions: event.notes
      .filter((note) => note.type === "DECISION")
      .map((note) => ({
        id: note.id,
        text: note.text,
        block: note.blockId ? (labels.get(note.blockId) ?? null) : null,
      })),
    notes: event.notes
      .filter((note) => note.type === "NOTE")
      .map((note) => ({
        id: note.id,
        text: note.text,
        block: note.blockId ? (labels.get(note.blockId) ?? null) : null,
      })),
    tasks,
  };
}
