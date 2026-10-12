import { describe, expect, it } from "vitest";

import {
  applyProtocolOp,
  countAttendance,
  protocolOpSchema,
  resolveCurrentBlock,
  type ProtocolState,
} from "../protocol";

const base: ProtocolState = {
  actualStart: null,
  actualEnd: null,
  summary: "",
  notes: [],
  blocks: [
    {
      id: "b1",
      label: "Sz. 1",
      kind: "SCENE",
      sceneId: "s1",
      plannedStart: null,
      plannedEnd: null,
      location: null,
      actualStart: null,
      actualEnd: null,
      outcome: null,
      note: "",
      unplanned: false,
    },
    {
      id: "b2",
      label: "Pause",
      kind: "CUSTOM",
      sceneId: null,
      plannedStart: null,
      plannedEnd: null,
      location: null,
      actualStart: null,
      actualEnd: null,
      outcome: null,
      note: "",
      unplanned: false,
    },
  ],
  people: [
    {
      userId: "u1",
      name: "Anna",
      detail: "",
      invited: true,
      declined: false,
      mark: null,
      at: null,
    },
  ],
  guests: [],
  media: [],
};

describe("applyProtocolOp", () => {
  it("startet und beendet einen Punkt und findet den nächsten", () => {
    const started = applyProtocolOp(base, {
      type: "block-start",
      blockId: "b1",
      at: "2026-10-04T12:00:00.000Z",
    });
    expect(resolveCurrentBlock(started.blocks)).toMatchObject({
      block: { id: "b1" },
      running: true,
    });
    const done = applyProtocolOp(started, {
      type: "block-finish",
      blockId: "b1",
      at: "2026-10-04T12:40:00.000Z",
      outcome: "DONE",
    });
    expect(resolveCurrentBlock(done.blocks)).toMatchObject({ block: { id: "b2" }, running: false });
  });

  it("fügt spontane Punkte und Dazugekommene nur einmal hinzu", () => {
    const op = { type: "block-add", blockId: "x", title: "Sz. 8", sceneId: null } as const;
    const once = applyProtocolOp(base, op);
    expect(applyProtocolOp(once, op).blocks).toHaveLength(3);

    const joined = applyProtocolOp(
      base,
      { type: "attendance", userId: "u2", mark: "LATE", at: "2026-10-04T12:20:00.000Z" },
      [{ userId: "u2", name: "Ben" }],
    );
    expect(joined.people.at(-1)).toMatchObject({ name: "Ben", invited: false, mark: "LATE" });
    expect(countAttendance(joined)).toEqual({ here: 1, expected: 1 });
  });

  it("sortiert nach der neuen Reihenfolge", () => {
    const next = applyProtocolOp(base, { type: "block-order", blockIds: ["b2", "b1"] });
    expect(next.blocks.map((block) => block.id)).toEqual(["b2", "b1"]);
  });
});

describe("Notizen", () => {
  it("legt Aufgaben mit Zuständigen an und entfernt sie wieder", () => {
    const added = applyProtocolOp(base, {
      type: "note-add",
      noteId: "n1",
      noteType: "TASK",
      text: "Koffer besorgen",
      blockId: null,
      assignee: { kind: "department", id: "d1" },
      dueAt: "2026-10-11",
    });
    // Älteres Format mit genau einer Zuständigkeit wird weiter verstanden.
    expect(added.notes[0]).toMatchObject({
      assignees: [{ kind: "department", id: "d1", doneAt: null }],
      dueAt: "2026-10-11",
    });
    const note = applyProtocolOp(base, {
      type: "note-add",
      noteId: "n2",
      noteType: "NOTE",
      text: "Licht zu dunkel",
      blockId: "b1",
      assignee: { kind: "user", id: "u1" },
      dueAt: "2026-10-11",
    });
    // Nur Aufgaben haben Zuständige und Fristen.
    expect(note.notes[0]).toMatchObject({ assignees: [], dueAt: null });
    expect(applyProtocolOp(added, { type: "note-remove", noteId: "n1" }).notes).toHaveLength(0);
  });
});

describe("Notizen bearbeiten", () => {
  const withTask = applyProtocolOp(base, {
    type: "note-add",
    noteId: "n1",
    noteType: "TASK",
    text: "Koffer besorgen",
    blockId: null,
    assignees: [
      { kind: "department", id: "d1" },
      { kind: "user", id: "u1" },
      { kind: "user", id: "u1" },
    ],
    dueAt: null,
  });

  it("legt mehrere Zuständige ohne Doppelte an", () => {
    expect(withTask.notes[0].assignees.map((entry) => entry.id)).toEqual(["d1", "u1"]);
  });

  it("ändert nur angegebene Felder und behält den Stand bleibender Zuständiger", () => {
    const done = {
      ...withTask,
      notes: withTask.notes.map((note) => ({
        ...note,
        assignees: note.assignees.map((entry) =>
          entry.id === "u1" ? { ...entry, doneAt: "2026-10-12T10:00:00.000Z" } : entry,
        ),
      })),
    };
    const edited = applyProtocolOp(done, {
      type: "note-edit",
      noteId: "n1",
      assignees: [{ kind: "user", id: "u1" }],
    });
    expect(edited.notes[0]).toMatchObject({
      text: "Koffer besorgen",
      assignees: [{ kind: "user", id: "u1", doneAt: "2026-10-12T10:00:00.000Z" }],
      doneAt: "2026-10-12T10:00:00.000Z",
    });
    expect(edited.notes[0].editedAt).not.toBeNull();
  });

  it("entfernt Zuständige und Frist, wenn aus der Aufgabe eine Notiz wird", () => {
    const edited = applyProtocolOp(withTask, {
      type: "note-edit",
      noteId: "n1",
      noteType: "NOTE",
      text: "Koffer fehlt",
    });
    expect(edited.notes[0]).toMatchObject({ type: "NOTE", text: "Koffer fehlt", assignees: [] });
  });

  it("versteht die alte Bearbeitung nur mit Text", () => {
    expect(
      protocolOpSchema.safeParse({ type: "note-edit", noteId: "n1", text: "neu" }).success,
    ).toBe(true);
  });
});

describe("Anhänge", () => {
  const upload = {
    id: "m1",
    kind: "AUDIO" as const,
    gallery: false,
    blockId: null,
    noteId: null,
    fileName: "memo.webm",
    mimeType: "audio/webm",
    fileSize: 10,
    durationSec: 3,
    width: null,
    height: null,
    caption: null,
    uploadedById: "u1",
    createdAt: "2026-10-12T10:00:00.000Z",
    url: "/m1",
    thumbUrl: null,
  };

  it("hängt hochgeladene Dateien an den neuen Eintrag", () => {
    const next = applyProtocolOp(
      { ...base, media: [upload] },
      {
        type: "note-add",
        noteId: "n1",
        noteType: "NOTE",
        text: "Memo",
        blockId: null,
        dueAt: null,
        mediaIds: ["m1"],
      },
    );
    expect(next.media[0].noteId).toBe("n1");
  });

  it("hängt beim Bearbeiten weitere an, aber nicht schon vergebene um", () => {
    const state = { ...base, media: [upload, { ...upload, id: "m2", noteId: "andere" }] };
    const added = applyProtocolOp(state, {
      type: "note-add",
      noteId: "n1",
      noteType: "NOTE",
      text: "Memo",
      blockId: null,
      dueAt: null,
    });
    const edited = applyProtocolOp(added, {
      type: "note-edit",
      noteId: "n1",
      mediaIds: ["m1", "m2"],
    });
    expect(edited.media.map((media) => media.noteId)).toEqual(["n1", "andere"]);
  });
});

describe("protocolOpSchema", () => {
  it("lehnt unbekannte Anwesenheit ab", () => {
    expect(
      protocolOpSchema.safeParse({ type: "attendance", userId: "u1", mark: "MAYBE", at: null })
        .success,
    ).toBe(false);
  });
});
