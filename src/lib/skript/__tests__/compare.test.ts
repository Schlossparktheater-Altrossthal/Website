import { describe, expect, it } from "vitest";

import { compareReaderData } from "../compare";
import type { ReaderBlock, ScriptReaderData } from "../reader";
import type { ScriptPart } from "../types";

let counter = 0;
function speech(roleId: string, speaker: string, ...parts: ScriptPart[]): ReaderBlock {
  counter += 1;
  return {
    id: `b${counter}`,
    lineageId: `l${counter}`,
    sceneId: "s1",
    kind: "speech",
    speaker,
    roleIds: [roleId],
    parts,
    words: 0,
    page: 1,
  };
}
const text = (value: string): ScriptPart => ({ kind: "text", text: value });
const cue = (category: "ton" | "licht", value: string): ScriptPart => ({
  kind: "cue",
  category,
  text: value,
});

function version(id: string, blocks: ReaderBlock[]): ScriptReaderData {
  return {
    version: {
      id,
      showId: "show",
      label: id,
      status: "released",
      versionDate: null,
      showTitle: "Test",
    },
    scenes: [{ id: "s1", title: "Szene 1", words: 0, minutes: 0, measuredSeconds: null }],
    credits: [],
    people: [],
    viewerId: null,
    blocks,
    roles: [
      { id: "a", name: "Atreju", lines: 0, words: 0, sceneIds: [] },
      { id: "b", name: "Bastian", lines: 0, words: 0, sceneIds: [] },
    ],
    ownRoleIds: ["a"],
  };
}

describe("compareReaderData", () => {
  const before = version("alt", [
    speech("a", "Atreju", text("Ich muss den Nachtalp finden.")),
    speech("b", "Bastian", text("Wo bin ich hier?"), cue("ton", "TON 3 Wind")),
    speech("a", "Atreju", text("Diese Zeile wird gestrichen, ganz und gar.")),
  ]);
  const after = version("neu", [
    speech("a", "Atreju", text("Ich muss den Nachtalp schnell finden.")),
    speech("b", "Bastian", text("Wo bin ich hier?"), cue("ton", "TON 3 Sturm")),
    speech("b", "Bastian", text("Ein ganz neuer Satz von Bastian.")),
  ]);
  const result = compareReaderData(before, after);
  const blocks = result.scenes[0].blocks;

  it("erkennt geänderte, neue und gestrichene Repliken", () => {
    expect(blocks.map((block) => block.type)).toEqual(["changed", "changed", "added", "removed"]);
    expect(result.stats).toEqual({ same: 0, changed: 2, added: 1, removed: 1 });
  });

  it("liefert den Wort-Diff und betroffene Rollen", () => {
    expect(blocks[0].words).toEqual([
      { op: "equal", text: "Ich muss den Nachtalp" },
      { op: "insert", text: "schnell" },
      { op: "equal", text: "finden." },
    ]);
    expect(blocks[3].roleIds).toEqual(["a"]);
    expect(blocks[3].block.parts[0]).toEqual(text("Diese Zeile wird gestrichen, ganz und gar."));
  });

  it("merkt geänderte Hinweise je Gewerk", () => {
    expect(blocks[1].cueCategories).toEqual(["ton"]);
    expect(blocks[0].cueCategories).toEqual([]);
  });
});
