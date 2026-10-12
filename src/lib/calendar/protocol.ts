import { z } from "zod";

/**
 * Probenmodus: Zustand und Änderungen. Jede Eingabe ist eine Operation, die der Browser sofort
 * auf seinen Zustand anwendet, in einer Warteschlange ablegt (auch offline) und an den Server
 * schickt. Der Server wendet dieselbe Operation auf die Datenbank an. Operationen setzen Werte
 * (statt sie zu verändern), damit doppeltes Senden nichts kaputt macht.
 */

export const ATTENDANCE_MARKS = ["PRESENT", "LATE", "LEFT_EARLY", "ABSENT", "EXCUSED"] as const;
export type AttendanceMarkValue = (typeof ATTENDANCE_MARKS)[number];

export const ATTENDANCE_LABELS: Record<AttendanceMarkValue, string> = {
  PRESENT: "da",
  LATE: "verspätet",
  LEFT_EARLY: "früher weg",
  ABSENT: "fehlt",
  EXCUSED: "entschuldigt",
};

export const NOTE_TYPES = ["NOTE", "DECISION", "TASK"] as const;
export type NoteTypeValue = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABELS: Record<NoteTypeValue, string> = {
  NOTE: "Notiz",
  DECISION: "Entscheidung",
  TASK: "Aufgabe",
};

/** Zuständig für eine Aufgabe: eine Person, eine Figur (deren Besetzung) oder ein Gewerk. */
export type TaskAssignee = { kind: "user" | "character" | "department"; id: string };

/** Zuständigkeit mit eigenem Erledigt-Stand. */
export type ProtocolAssignee = TaskAssignee & { doneAt: string | null };

export const assigneeKey = (assignee: TaskAssignee) => `${assignee.kind}:${assignee.id}`;

/** Zuständige ohne Doppelte, in der gegebenen Reihenfolge. */
export function uniqueAssignees(assignees: readonly TaskAssignee[]): TaskAssignee[] {
  const seen = new Set<string>();
  return assignees.flatMap((assignee) => {
    const key = assigneeKey(assignee);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ kind: assignee.kind, id: assignee.id }];
  });
}

/**
 * Wie weit jemand den Probenmodus nutzen darf: `full` führt das Protokoll, `notes` (Leitung oder
 * Stellvertretung eines Gewerks der Produktion) darf nur Notizen und Aufgaben hinterlegen – auch
 * schon zur Vorbereitung – und nur die eigenen ändern. `contribute` (Eingeladene und Anwesende)
 * hinterlegt Notizen mit Fotos und Sprachmemos, nur eigene.
 */
export type ProtocolAccess = "full" | "notes" | "contribute";

/** Datei zu einem Termin (Foto, Audio, PDF), wie die Oberfläche sie braucht. */
export type ProtocolMedia = {
  id: string;
  kind: "IMAGE" | "AUDIO" | "FILE";
  gallery: boolean;
  blockId: string | null;
  noteId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  uploadedById: string | null;
  createdAt: string;
  url: string;
  thumbUrl: string | null;
};

export const OUTCOMES = ["DONE", "PARTIAL", "SKIPPED"] as const;
export type OutcomeValue = (typeof OUTCOMES)[number];

const id = z.string().min(1).max(64);
const iso = z.string().datetime();
const assigneeSchema = z.object({ kind: z.enum(["user", "character", "department"]), id });

export const protocolOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event-time"), field: z.enum(["start", "end"]), at: iso.nullable() }),
  z.object({ type: z.literal("block-start"), blockId: id, at: iso.nullable() }),
  z.object({
    type: z.literal("block-finish"),
    blockId: id,
    at: iso.nullable(),
    outcome: z.enum(OUTCOMES).nullable(),
  }),
  z.object({ type: z.literal("block-note"), blockId: id, note: z.string().max(2000) }),
  z.object({ type: z.literal("block-order"), blockIds: z.array(id).max(200) }),
  z.object({
    type: z.literal("block-add"),
    blockId: id,
    title: z.string().trim().min(1).max(200),
    sceneId: id.nullable(),
  }),
  z.object({
    type: z.literal("attendance"),
    userId: id,
    mark: z.enum(ATTENDANCE_MARKS).nullable(),
    at: iso.nullable(),
  }),
  z.object({ type: z.literal("guest-add"), guestId: id, name: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal("guest-remove"), guestId: id }),
  z.object({
    type: z.literal("note-add"),
    noteId: id,
    noteType: z.enum(NOTE_TYPES),
    text: z.string().trim().min(1).max(4000),
    blockId: id.nullable(),
    assignees: z.array(assigneeSchema).max(60).optional(),
    /** Älterer Stand mit genau einer Zuständigkeit (Warteschlangen alter Geräte). */
    assignee: assigneeSchema.nullable().optional(),
    dueAt: z.string().date().nullable(),
    /** Aufgabe: Zuständige benachrichtigen, Notiz/Entscheidung: alle Eingeladenen. */
    notify: z.boolean().optional(),
    /** Vorher hochgeladene eigene Anhänge, die zu diesem Eintrag gehören. */
    mediaIds: z.array(id).max(30).optional(),
  }),
  /** Ändert nur die angegebenen Felder. */
  z.object({
    type: z.literal("note-edit"),
    noteId: id,
    text: z.string().trim().min(1).max(4000).optional(),
    noteType: z.enum(NOTE_TYPES).optional(),
    blockId: id.nullable().optional(),
    assignees: z.array(assigneeSchema).max(60).optional(),
    dueAt: z.string().date().nullable().optional(),
    /** Neu hinzugekommene Zuständige benachrichtigen. */
    notify: z.boolean().optional(),
    /** Zusätzliche, vorher hochgeladene eigene Anhänge. */
    mediaIds: z.array(id).max(30).optional(),
  }),
  z.object({ type: z.literal("note-remove"), noteId: id }),
  z.object({ type: z.literal("summary"), text: z.string().max(8000) }),
]);

export type ProtocolOp = z.infer<typeof protocolOpSchema>;

export type ProtocolBlock = {
  id: string;
  label: string;
  kind: "SCENE" | "DEPARTMENT" | "CUSTOM";
  sceneId: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  location: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  outcome: OutcomeValue | null;
  note: string;
  unplanned: boolean;
};

export type ProtocolPerson = {
  userId: string;
  name: string;
  /** Warum eingeladen, z. B. Figur; leer bei spontan Dazugekommenen. */
  detail: string;
  invited: boolean;
  /** Hatte vorher abgesagt. */
  declined: boolean;
  mark: AttendanceMarkValue | null;
  at: string | null;
};

export type ProtocolNote = {
  id: string;
  authorId: string | null;
  authorName: string | null;
  type: NoteTypeValue;
  text: string;
  blockId: string | null;
  assignees: ProtocolAssignee[];
  dueAt: string | null;
  /** Erledigt, sobald alle Zuständigen erledigt haben. */
  doneAt: string | null;
  createdAt: string;
  editedAt: string | null;
};

/** Zuständige einer `note-add`-Operation (neues und altes Format). */
export function noteAddAssignees(op: Extract<ProtocolOp, { type: "note-add" }>) {
  if (op.noteType !== "TASK") return [];
  return uniqueAssignees(op.assignees ?? (op.assignee ? [op.assignee] : []));
}

/** Abgeleiteter Erledigt-Stand: der späteste, wenn alle erledigt haben. */
export function allDoneAt(assignees: readonly { doneAt: string | null }[]) {
  if (!assignees.length || assignees.some((entry) => !entry.doneAt)) return null;
  return (
    assignees
      .map((entry) => entry.doneAt as string)
      .sort()
      .at(-1) ?? null
  );
}

/** Auswahl für Zuständige einer Aufgabe. */
export type AssigneeOption = TaskAssignee & { label: string };

export type ProtocolState = {
  actualStart: string | null;
  actualEnd: string | null;
  summary: string;
  notes: ProtocolNote[];
  blocks: ProtocolBlock[];
  people: ProtocolPerson[];
  guests: { id: string; name: string }[];
  media: ProtocolMedia[];
};

/** Mitglied, das spontan dazukommen kann (für „+ Person“). */
export type ProtocolCandidate = { userId: string; name: string };

/** Wendet eine Operation auf den Zustand an (Browser: sofort, vor der Server-Antwort). */
export function applyProtocolOp(
  state: ProtocolState,
  op: ProtocolOp,
  candidates: readonly ProtocolCandidate[] = [],
): ProtocolState {
  const updateBlock = (blockId: string, patch: Partial<ProtocolBlock>) => ({
    ...state,
    blocks: state.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
  });

  switch (op.type) {
    case "event-time":
      return op.field === "start"
        ? { ...state, actualStart: op.at }
        : { ...state, actualEnd: op.at };
    case "block-start":
      return updateBlock(op.blockId, { actualStart: op.at, ...(op.at ? {} : { actualEnd: null }) });
    case "block-finish":
      return updateBlock(op.blockId, { actualEnd: op.at, outcome: op.outcome });
    case "block-note":
      return updateBlock(op.blockId, { note: op.note });
    case "block-order": {
      const byId = new Map(state.blocks.map((block) => [block.id, block]));
      const ordered = op.blockIds.flatMap((blockId) => byId.get(blockId) ?? []);
      const rest = state.blocks.filter((block) => !op.blockIds.includes(block.id));
      return { ...state, blocks: [...ordered, ...rest] };
    }
    case "block-add":
      if (state.blocks.some((block) => block.id === op.blockId)) return state;
      return {
        ...state,
        blocks: [
          ...state.blocks,
          {
            id: op.blockId,
            label: op.title,
            kind: op.sceneId ? "SCENE" : "CUSTOM",
            sceneId: op.sceneId,
            plannedStart: null,
            plannedEnd: null,
            location: null,
            actualStart: null,
            actualEnd: null,
            outcome: null,
            note: "",
            unplanned: true,
          },
        ],
      };
    case "attendance": {
      const existing = state.people.find((person) => person.userId === op.userId);
      if (existing) {
        return {
          ...state,
          people: state.people.map((person) =>
            person.userId === op.userId ? { ...person, mark: op.mark, at: op.at } : person,
          ),
        };
      }
      const candidate = candidates.find((entry) => entry.userId === op.userId);
      if (!candidate || !op.mark) return state;
      return {
        ...state,
        people: [
          ...state.people,
          {
            userId: op.userId,
            name: candidate.name,
            detail: "dazugekommen",
            invited: false,
            declined: false,
            mark: op.mark,
            at: op.at,
          },
        ],
      };
    }
    case "guest-add":
      if (state.guests.some((guest) => guest.id === op.guestId)) return state;
      return { ...state, guests: [...state.guests, { id: op.guestId, name: op.name }] };
    case "guest-remove":
      return { ...state, guests: state.guests.filter((guest) => guest.id !== op.guestId) };
    case "note-add":
      if (state.notes.some((note) => note.id === op.noteId)) return state;
      return linkMedia(
        {
          ...state,
          notes: [
            ...state.notes,
            {
              id: op.noteId,
              authorId: null,
              authorName: null,
              type: op.noteType,
              text: op.text,
              blockId: op.blockId,
              assignees: noteAddAssignees(op).map((assignee) => ({ ...assignee, doneAt: null })),
              dueAt: op.noteType === "TASK" ? op.dueAt : null,
              doneAt: null,
              createdAt: new Date().toISOString(),
              editedAt: null,
            },
          ],
        },
        op.noteId,
        op.mediaIds,
      );
    case "note-edit":
      return linkMedia(
        {
          ...state,
          notes: state.notes.map((note) => (note.id === op.noteId ? editNote(note, op) : note)),
        },
        op.noteId,
        op.mediaIds,
      );
    case "note-remove":
      return { ...state, notes: state.notes.filter((note) => note.id !== op.noteId) };
    case "summary":
      return { ...state, summary: op.text };
  }
}

function linkMedia(state: ProtocolState, noteId: string, mediaIds: readonly string[] = []) {
  if (!mediaIds.length) return state;
  return {
    ...state,
    media: state.media.map((media) =>
      mediaIds.includes(media.id) && !media.noteId ? { ...media, noteId } : media,
    ),
  };
}

/** Wendet eine Bearbeitung auf einen Eintrag an; wer Zuständiger bleibt, behält seinen Stand. */
export function editNote(
  note: ProtocolNote,
  op: Extract<ProtocolOp, { type: "note-edit" }>,
): ProtocolNote {
  const type = op.noteType ?? note.type;
  const task = type === "TASK";
  const previous = new Map(note.assignees.map((entry) => [assigneeKey(entry), entry]));
  const assignees = !task
    ? []
    : op.assignees
      ? uniqueAssignees(op.assignees).map(
          (assignee) => previous.get(assigneeKey(assignee)) ?? { ...assignee, doneAt: null },
        )
      : note.assignees;
  return {
    ...note,
    type,
    text: op.text ?? note.text,
    blockId: op.blockId === undefined ? note.blockId : op.blockId,
    assignees,
    dueAt: !task ? null : op.dueAt === undefined ? note.dueAt : op.dueAt,
    doneAt: task ? allDoneAt(assignees) : null,
    editedAt: new Date().toISOString(),
  };
}

/** Der Punkt, der gerade läuft, sonst der nächste noch nicht begonnene. */
export function resolveCurrentBlock(blocks: readonly ProtocolBlock[]) {
  const running = blocks.find((block) => block.actualStart && !block.actualEnd);
  if (running) return { block: running, running: true };
  const next = blocks.find((block) => !block.actualStart && !block.outcome);
  return next ? { block: next, running: false } : null;
}

/** Zähler für die Anwesenheit: wer da ist (auch verspätet/früher weg) von allen Erwarteten. */
export function countAttendance(state: ProtocolState) {
  const expected = state.people.filter((person) => person.invited);
  const here = state.people.filter(
    (person) => person.mark === "PRESENT" || person.mark === "LATE" || person.mark === "LEFT_EARLY",
  );
  return { here: here.length + state.guests.length, expected: expected.length };
}
