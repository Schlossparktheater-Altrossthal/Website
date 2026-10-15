import { describe, expect, it } from "vitest";

import type { ReaderAnnotation } from "@/lib/skript/annotation-types";

import { applyOutbox, type OutboxOp } from "@/app/(reader)/mitglieder/skript/[fassung]/outbox";

const note = (id: string, body = "x"): ReaderAnnotation =>
  ({ id, kind: "note", body, color: null, strokes: [] }) as unknown as ReaderAnnotation;

describe("applyOutbox", () => {
  it("legt wartende Änderungen in Reihenfolge über den gespeicherten Stand", () => {
    const ops: OutboxOp[] = [
      { type: "create", input: {} as never, annotation: note("neu", "a") },
      { type: "update", id: "neu", patch: { body: "b" } },
      { type: "delete", id: "alt" },
    ];
    const result = applyOutbox([note("alt"), note("bleibt")], ops);
    expect(result.map((entry) => [entry.id, entry.body])).toEqual([
      ["bleibt", "x"],
      ["neu", "b"],
    ]);
  });

  it("legt eine schon gespeicherte Notiz nicht doppelt an", () => {
    const ops: OutboxOp[] = [{ type: "create", input: {} as never, annotation: note("a") }];
    expect(applyOutbox([note("a")], ops)).toHaveLength(1);
  });

  it("ersetzt oder entfernt Notizzettel", () => {
    const sketch = { ...note("z"), kind: "ink" } as ReaderAnnotation;
    const replaced = applyOutbox(
      [sketch],
      [{ type: "sketch", input: { id: "z" } as never, annotation: { ...sketch, body: "neu" } }],
    );
    expect(replaced[0].body).toBe("neu");
    expect(
      applyOutbox([sketch], [{ type: "sketch", input: { id: "z" } as never, annotation: null }]),
    ).toEqual([]);
  });
});
