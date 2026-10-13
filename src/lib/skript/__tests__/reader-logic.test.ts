import { describe, expect, it } from "vitest";

import {
  cueLineIndices,
  findNextTarget,
  firstVisibleIndex,
  isRoleBlock,
  type LogicBlock,
  splitTail,
} from "../reader-logic";
import type { ScriptPart } from "../types";

const speech = (role: string, text = "Text"): LogicBlock => ({
  kind: "speech" as const,
  roleIds: [role],
  parts: [{ kind: "text", text } satisfies ScriptPart],
});
const direction: LogicBlock = { kind: "direction" as const, roleIds: [], parts: [] };

const blocks = [speech("a"), direction, speech("b"), speech("c"), direction, speech("a")];
const mine = new Set(["a"]);
const isMine = (block: LogicBlock) => isRoleBlock(block, mine);

describe("findNextTarget", () => {
  it("zeigt keine Vorschau, solange eine eigene Passage sichtbar ist", () => {
    expect(findNextTarget(blocks, isMine, 0, 1)).toBeNull();
  });

  it("zählt die Repliken bis zur nächsten eigenen Passage", () => {
    expect(findNextTarget(blocks, isMine, 1, 1)).toEqual({ index: 5, linesAway: 2 });
    expect(findNextTarget(blocks, isMine, 2, 3)).toEqual({ index: 5, linesAway: 0 });
  });

  it("liefert nichts nach der letzten Passage", () => {
    expect(findNextTarget(blocks, isMine, 5, 5)).toBeNull();
    expect(findNextTarget(blocks.slice(0, 5), isMine, 1, 4)).toBeNull();
  });
});

describe("cueLineIndices", () => {
  it("markiert die letzte fremde Replik vor der eigenen, Regie übersprungen", () => {
    expect([...cueLineIndices(blocks, mine)]).toEqual([3]);
  });

  it("kein Stichwort, wenn die eigene Rolle direkt weiterspricht", () => {
    expect([...cueLineIndices([speech("a"), speech("a")], mine)]).toEqual([]);
  });
});

describe("splitTail", () => {
  it("trennt die letzten Wörter ab", () => {
    expect(splitTail("eins zwei drei vier", 2)).toEqual(["eins zwei ", "drei vier"]);
    expect(splitTail("kurz", 6)).toEqual(["", "kurz"]);
  });
});

describe("firstVisibleIndex", () => {
  it("findet das erste Element unterhalb des Versatzes", () => {
    expect(firstVisibleIndex([10, 20, 30], 15)).toBe(1);
    expect(firstVisibleIndex([10, 20, 30], 40)).toBe(3);
    expect(firstVisibleIndex([10, 20, 30], 0)).toBe(0);
  });
});
