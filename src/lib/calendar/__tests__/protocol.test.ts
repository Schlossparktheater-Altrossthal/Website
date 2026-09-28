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

describe("protocolOpSchema", () => {
  it("lehnt unbekannte Anwesenheit ab", () => {
    expect(
      protocolOpSchema.safeParse({ type: "attendance", userId: "u1", mark: "MAYBE", at: null })
        .success,
    ).toBe(false);
  });
});
