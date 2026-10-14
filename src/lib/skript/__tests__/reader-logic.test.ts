import { describe, expect, it } from "vitest";

import {
  cueLineIndices,
  cueSegments,
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

describe("cueSegments", () => {
  const t = (text: string) => ({ part: { kind: "text" as const, text } });
  const d = (text: string) => ({ part: { kind: "direction" as const, text } });
  const c = (text: string) => ({ part: { kind: "cue" as const, text, category: "ton" as const } });
  const shape = (parts: { part: ScriptPart }[]) =>
    cueSegments(parts).map((segment) => ({
      before: segment.before.map((entry) => entry.part.text),
      items: segment.items.map((item) =>
        item.type === "part"
          ? item.slice.entry.part.text.slice(item.slice.from, item.slice.to).trim()
          : `[${item.number ?? "|"}]`,
      ),
      after: segment.after.map((item) => `${item.number ?? ""}${item.entry.part.text}`),
    }));

  it("lässt Absätze ohne Hinweise unverändert", () => {
    expect(shape([t("Hallo."), d("lacht"), t("Na!")])).toEqual([
      { before: [], items: ["Hallo.", "lacht", "Na!"], after: [] },
    ]);
  });

  it("setzt Hinweise am Ende ohne Marke darunter", () => {
    expect(shape([t("Geh!"), c("TON 1"), c("LICHT")])).toEqual([
      { before: [], items: ["Geh!"], after: ["TON 1", "LICHT"] },
    ]);
  });

  it("markiert einen Hinweis mitten im Satz und setzt ihn unter das Satzende", () => {
    expect(shape([t("Es ist anders –"), c("TON 2b"), t("ungefährlich."), t("Weiter.")])).toEqual([
      { before: [], items: ["Es ist anders –", "[|]", "ungefährlich."], after: ["TON 2b"] },
      { before: [], items: ["Weiter."], after: [] },
    ]);
  });

  it("nummeriert mehrere Hinweise im selben Satz", () => {
    expect(shape([t("Genau."), c("TON 10"), d("schlupft zurück"), c("NEBEL"), c("LICHT")])).toEqual(
      [
        {
          before: [],
          items: ["Genau.", "[1]", "schlupft zurück", "[2]", "[3]"],
          after: ["1TON 10", "2NEBEL", "3LICHT"],
        },
      ],
    );
  });

  it("teilt einen langen Teil am Satzende hinter dem Hinweis", () => {
    expect(
      shape([t("Ein Funken."), c("TON 4"), t("Er wird größer. Ein Turm. Noch mehr.")]),
    ).toEqual([
      { before: [], items: ["Ein Funken.", "[|]", "Er wird größer."], after: ["TON 4"] },
      { before: [], items: ["Ein Turm. Noch mehr."], after: [] },
    ]);
  });

  it("stellt Hinweise vor dem ersten Text darüber", () => {
    expect(shape([c("LICHT"), c("TON 2a"), d("vorm Eintritt Bastian.")])).toEqual([
      { before: ["LICHT", "TON 2a"], items: ["vorm Eintritt Bastian."], after: [] },
    ]);
  });
});
