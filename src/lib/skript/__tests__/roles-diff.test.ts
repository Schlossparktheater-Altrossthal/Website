import { describe, expect, it } from "vitest";

import { align, diffScripts, similarity, wordDiff } from "@/lib/skript/diff";
import { splitInlineCues } from "@/lib/skript/parse";
import { BOLD_COLON_PROFILE } from "@/lib/skript/profiles";
import {
  findRoleTypos,
  jaroWinkler,
  levenshtein,
  resolveRoleNames,
  roleKey,
  roleStatistics,
  splitSpeakerRoles,
} from "@/lib/skript/roles";
import type { ScriptBlock, ScriptScene } from "@/lib/skript/types";

const speech = (speaker: string, text: string): ScriptBlock => ({
  kind: "speech",
  speaker,
  parts: [{ kind: "text", text }],
  page: 1,
});

const scene = (title: string, blocks: ScriptBlock[]): ScriptScene => ({ title, blocks });

describe("Rollen", () => {
  it("normalisiert Schreibweisen", () => {
    expect(roleKey("ATRÉJU")).toBe(roleKey("Atreju"));
    expect(roleKey("Felsenbeißer")).toBe(roleKey("Felsenbeisser"));
  });

  it("misst Abstände", () => {
    expect(levenshtein("ygramul", "ygramuls")).toBe(1);
    expect(jaroWinkler("koreander", "koreandr")).toBeGreaterThan(0.95);
    expect(jaroWinkler("bastian", "morla")).toBeLessThan(0.6);
  });

  it("führt Schreibweisen und eindeutige Abkürzungen zusammen, bestätigte Aliase gewinnen", () => {
    const scenes = [
      scene("S1", [
        speech("Atreju", "a"),
        speech("Atreju", "b"),
        speech("ATRÉJU", "c"),
        speech("KINDLICHE KAISERIN", "d"),
        speech("KINDL. KAISERIN", "e"),
      ]),
    ];
    const mapping = resolveRoleNames(scenes);
    expect(mapping.get("ATRÉJU")).toBe("Atreju");
    expect(mapping.get("KINDL. KAISERIN")).toBe("KINDLICHE KAISERIN");

    const withAlias = resolveRoleNames(scenes, new Map([[roleKey("Atreju"), "Atréju"]]));
    expect(withAlias.get("Atreju")).toBe("Atréju");
  });

  it("schlägt Tippfehler nur vor", () => {
    const typos = findRoleTypos([
      scene("S1", [speech("Ygramul", "a"), speech("Ygramul", "b"), speech("Ygramuls", "c")]),
    ]);
    expect(typos).toEqual([expect.objectContaining({ name: "Ygramuls", similarTo: "Ygramul" })]);
  });

  it("teilt gemeinsame Repliken und zählt Wörter nur im gesprochenen Text", () => {
    expect(splitSpeakerRoles("Atreju/Bastian")).toEqual(["Atreju", "Bastian"]);
    expect(splitSpeakerRoles("Urgl und Engywuck")).toEqual(["Urgl", "Engywuck"]);
    const stats = roleStatistics([
      scene("S1", [
        {
          ...speech("Bastian", "Drei Wörter hier"),
          parts: [
            { kind: "direction", text: "zählt nicht" },
            { kind: "text", text: "Drei Wörter hier" },
          ],
        },
      ]),
    ]);
    expect(stats[0]).toMatchObject({ name: "Bastian", lines: 1, words: 3, scenes: ["S1"] });
  });
});

describe("Unmarkierte Hinweise", () => {
  it("endet an Zahl, Endwort oder Satzzeichen", () => {
    expect(
      splitInlineCues("Rettet sie! TON 19 Erdbeben 2 Was wird aus mir?", BOLD_COLON_PROFILE),
    ).toEqual([
      { kind: "text", text: "Rettet sie! " },
      { kind: "cue", category: "ton", text: "TON 19 Erdbeben 2", auto: true },
      { kind: "text", text: " Was wird aus mir?" },
    ]);
    expect(splitInlineCues("MUSIK 5, läuft aus", BOLD_COLON_PROFILE)[0]).toMatchObject({
      text: "MUSIK 5,",
    });
  });

  it("greift nicht bei normal geschriebenem Text", () => {
    expect(splitInlineCues("Finsternis - Licht! Musik endet", BOLD_COLON_PROFILE)).toEqual([
      { kind: "text", text: "Finsternis - Licht! Musik endet" },
    ]);
  });
});

describe("Fassungsvergleich", () => {
  it("ordnet zu, auch wenn Absätze eingefügt wurden", () => {
    const pairs = align(
      ["a b c", "d e f", "g h i"],
      ["a b c", "x y z", "d e f", "g h X"],
      similarity,
    );
    expect(pairs).toEqual([
      ["a b c", "a b c"],
      [null, "x y z"],
      ["d e f", "d e f"],
      ["g h i", "g h X"],
    ]);
  });

  it("zählt gleich/geändert/neu/entfernt und erkennt umbenannte Rollen", () => {
    const before = [
      scene("SZENE 1", [
        speech("Wesen", "Schöpfung, Erschaffung, Kreation, Inspiration, Träume, Licht!"),
        speech("Bastian", "Oh, Entschuldigung!"),
        speech("Koreander", "Das Theater ist geschlossen."),
        speech("Koreander", "Raus hier!"),
      ]),
    ];
    const after = [
      scene("SZENE 1", [
        speech("Magierin", "Schöpfung, Erschaffung, Kreation, Inspiration, Träume, Licht!"),
        speech("Bastian", "Oh, Entschuldigung!"),
        speech("Koreander", "Das Theater hat geschlossen."),
        speech("Bastian", "Warum?"),
      ]),
    ];
    const { stats, scenes } = diffScripts(before, after);
    expect(stats).toEqual({ same: 1, changed: 2, added: 1, removed: 1 });
    expect(scenes[0].blocks[0]).toMatchObject({ type: "changed" });
  });

  it("liefert Wort-Unterschiede", () => {
    expect(wordDiff("Das Theater ist geschlossen", "Das Theater hat geschlossen")).toEqual([
      { op: "equal", text: "Das Theater" },
      { op: "delete", text: "ist" },
      { op: "insert", text: "hat" },
      { op: "equal", text: "geschlossen" },
    ]);
  });
});
