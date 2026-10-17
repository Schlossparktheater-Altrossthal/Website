import { describe, expect, it } from "vitest";

import {
  buildSceneHeaders,
  hasOwnCueNumber,
  formatCueNumbers,
  sanitizeSceneHeader,
  DEFAULT_SCENE_HEADER,
} from "@/lib/skript/scene-header";
import type { StatsInput } from "@/lib/skript/stats";

const block = (
  id: string,
  sceneId: string,
  roleIds: string[],
  text: string,
): StatsInput["blocks"][number] => ({
  id,
  sceneId,
  kind: roleIds.length ? "speech" : "direction",
  speaker: roleIds.join("/") || null,
  roleIds,
  parts: roleIds.length ? [{ kind: "text", text }] : [{ kind: "direction", text }],
  words: roleIds.length ? text.split(/\s+/).length : 0,
  page: 1,
});

const input: StatsInput = {
  scenes: [
    { id: "s1", title: "Szene 1" },
    { id: "s2", title: "Szene 2" },
    { id: "s3", title: "Szene 3" },
  ],
  roles: [
    { id: "a", name: "Atreju" },
    { id: "b", name: "Bastian" },
    { id: "m", name: "Morla" },
  ],
  blocks: [
    block("1", "s1", [], "Morla schläft im Hintergrund."),
    block("2", "s1", ["a"], "Wo bin ich hier"),
    {
      ...block("3", "s1", ["b"], "In Phantásien natürlich"),
      parts: [
        { kind: "text", text: "In Phantásien natürlich" },
        { kind: "cue", category: "ton", text: "TON 1 Donner" },
      ],
    },
    block("4", "s2", ["b"], "Allein hier"),
    {
      ...block("5", "s2", [], "Licht aus"),
      parts: [{ kind: "cue", category: "licht", text: "LICHT 2 aus" }],
    },
    block("6", "s2", ["a"], "Ich komme wieder"),
    block("7", "s3", ["c"], "Fremd"),
  ],
};

const all = ["roles", "mine", "duration", "size", "cues", "transition", "notes"] as const;

describe("Szenenkopf", () => {
  it("nennt Sprechende, Erwähnte, eigenen Teil mit erstem Stichwort", () => {
    const heads = buildSceneHeaders(input, { items: all, roleIds: ["a"], hiddenCues: [] });
    const s1 = heads.get("s1");
    expect(s1?.roles?.speaking.map((r) => [r.id, r.mine])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(s1?.roles?.mentioned).toEqual(["m"]);
    expect(s1?.mine).toMatchObject({ words: 4, passages: 1, cue: "" });
    const s2 = heads.get("s2");
    expect(s2?.mine).toMatchObject({ cueSpeaker: "b", cue: "Allein hier" });
    expect(s2?.transition?.continuing.sort()).toEqual(["a", "b"]);
    expect(s2?.cues?.map((c) => c.category)).toEqual(["licht"]);
    expect(s1?.size).toMatchObject({ pages: { from: 1, to: 1 }, passages: 2 });
  });

  it("blendet ausgeblendete Gewerke und leere Bausteine aus", () => {
    const heads = buildSceneHeaders(input, {
      items: ["cues", "mine"],
      roleIds: ["a"],
      hiddenCues: ["licht"],
    });
    expect(heads.get("s2")?.cues).toBeNull();
    expect(heads.get("s3")).toBeNull();
  });

  it("zählt Notizen nur, wenn welche da sind", () => {
    const heads = buildSceneHeaders(input, {
      items: ["notes"],
      roleIds: [],
      hiddenCues: [],
      noteCounts: new Map([["s1", 2]]),
    });
    expect(heads.get("s1")?.notes).toBe(2);
    expect(heads.get("s2")).toBeNull();
  });

  it("fasst Hinweisnummern zusammen", () => {
    const entry = (number: number) => ({
      number,
      category: "licht" as const,
      text: "",
      sceneId: "s",
      blockId: "b",
      page: null,
      after: "",
    });
    expect(formatCueNumbers("licht", [entry(3)])).toBe("L3");
    expect(formatCueNumbers("licht", [entry(3), entry(4), entry(5)])).toBe("L3–L5");
    expect(formatCueNumbers("licht", [entry(3), entry(7)])).toBe("L3, L7");
  });

  it("nummeriert nur Gewerke, die das Skript nicht selbst nummeriert", () => {
    expect(hasOwnCueNumber("LICHT 12 Abendrot")).toBe(true);
    expect(hasOwnCueNumber("Abendrot")).toBe(false);
    const heads = buildSceneHeaders(input, { items: ["cues"], roleIds: [], hiddenCues: [] });
    // „TON 1 Donner“ bzw. „LICHT 2 aus“ bringen eigene Nummern mit.
    expect(heads.get("s1")?.cues?.[0].entries[0].tag).toBeNull();
    const plain: StatsInput = {
      ...input,
      blocks: input.blocks.map((b) => ({
        ...b,
        parts: b.parts.map((part) =>
          part.kind === "cue" ? { ...part, text: part.text.replace(/^\w+ \d+ /, "") } : part,
        ),
      })),
    };
    const numbered = buildSceneHeaders(plain, { items: ["cues"], roleIds: [], hiddenCues: [] });
    expect(numbered.get("s2")?.cues?.[0].entries[0].tag).toBe("L1");
  });

  it("liest alte oder kaputte Einstellungen mit Standardwerten", () => {
    expect(sanitizeSceneHeader(undefined)).toEqual(DEFAULT_SCENE_HEADER);
    expect(sanitizeSceneHeader({ mode: "quatsch" })).toEqual(DEFAULT_SCENE_HEADER);
    expect(sanitizeSceneHeader({ mode: "card", items: ["cues", "cues"] })).toMatchObject({
      mode: "card",
      items: ["cues"],
    });
  });
});
