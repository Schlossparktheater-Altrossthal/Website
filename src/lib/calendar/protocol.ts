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

export const OUTCOMES = ["DONE", "PARTIAL", "SKIPPED"] as const;
export type OutcomeValue = (typeof OUTCOMES)[number];

const id = z.string().min(1).max(64);
const iso = z.string().datetime();

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

export type ProtocolState = {
  actualStart: string | null;
  actualEnd: string | null;
  blocks: ProtocolBlock[];
  people: ProtocolPerson[];
  guests: { id: string; name: string }[];
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
  }
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
