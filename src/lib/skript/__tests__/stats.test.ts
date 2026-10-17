import { describe, expect, it } from "vitest";

import {
  computeScriptStats,
  cueScript,
  formatDuration,
  parseDurationInput,
  sceneTitleKey,
  type StatsInput,
} from "@/lib/skript/stats";
import { cueListCsv, matrixCsv, roleStatsCsv, toCsv } from "@/lib/skript/stats-csv";

const block = (
  id: string,
  sceneId: string,
  roleIds: string[],
  text: string,
  extra: Partial<StatsInput["blocks"][number]> = {},
): StatsInput["blocks"][number] => ({
  id,
  sceneId,
  kind: roleIds.length ? "speech" : "direction",
  speaker: roleIds.join("/") || null,
  roleIds,
  parts: roleIds.length ? [{ kind: "text", text }] : [{ kind: "direction", text }],
  words: roleIds.length ? text.split(/\s+/).length : 0,
  page: 1,
  ...extra,
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
    block("4", "s1", ["a", "b"], "Gemeinsam", { page: 2 }),
    block("5", "s2", ["b"], "Allein hier"),
    {
      ...block("6", "s2", [], "Licht aus"),
      parts: [{ kind: "cue", category: "licht", text: "LICHT 2 aus" }],
    },
    block("7", "s3", ["a"], "Zurück"),
  ],
};

describe("Skript-Auswertungen", () => {
  const stats = computeScriptStats(input);

  it("zählt Wörter und Passagen je Rolle, gemeinsame Repliken voll", () => {
    const a = stats.roles.find((r) => r.id === "a");
    const b = stats.roles.find((r) => r.id === "b");
    expect(a).toMatchObject({ words: 6, passages: 3, longestPassage: 4, sceneIds: ["s1", "s3"] });
    expect(b).toMatchObject({ words: 6, passages: 3, sceneIds: ["s1", "s2"] });
    expect(stats.totalWords).toBe(11);
    expect(stats.totalPassages).toBe(5);
    expect(b?.share).toBeCloseTo(6 / 11);
  });

  it("fasst Szenen zusammen: Rollen, Seiten, Hinweise mit Stichwort, Erwähnte", () => {
    const [s1, s2] = stats.scenes;
    expect(s1.roles).toEqual([
      { id: "a", words: 5, passages: 2 },
      { id: "b", words: 4, passages: 2 },
    ]);
    expect(s1.pages).toEqual({ from: 1, to: 2 });
    expect(s1.mentionedRoleIds).toEqual(["m"]);
    expect(s1.cues.ton[0]).toMatchObject({
      number: 1,
      after: "Wo bin ich hier In Phantásien natürlich",
    });
    expect(s2.cues.licht[0]).toMatchObject({ number: 1, after: "Allein hier" });
    expect(stats.cues).toHaveLength(2);
  });

  it("findet Pausen und bevorzugt gemessene Zeiten", () => {
    expect(stats.gaps).toEqual([
      { roleId: "a", afterSceneId: "s1", untilSceneId: "s3", scenes: 1 },
    ]);
    const measured = computeScriptStats({ ...input, measuredSeconds: new Map([["s1", 600]]) });
    expect(measured.scenes[0].duration).toEqual({ seconds: 600, estimated: false });
    expect(formatDuration(measured.scenes[0].duration)).toBe("10 min");
    expect(formatDuration({ seconds: 3900, estimated: true })).toBe("ca. 1:05 h");
    expect(formatDuration({ seconds: 12, estimated: true })).toBe("< 1 min");
  });

  it("baut das Stichwortheft", () => {
    expect(cueScript(input, ["a"], 2)).toEqual([
      { blockId: "2", sceneId: "s1", cueSpeaker: null, cue: "", text: "Wo bin ich hier" },
      {
        blockId: "4",
        sceneId: "s1",
        cueSpeaker: "b",
        cue: "Phantásien natürlich",
        text: "Gemeinsam",
      },
      { blockId: "7", sceneId: "s3", cueSpeaker: "b", cue: "Allein hier", text: "Zurück" },
    ]);
  });
});

describe("CSV der Auswertungen", () => {
  const stats = computeScriptStats(input);
  it("schreibt Semikolon-CSV mit BOM, Komma als Dezimaltrenner und Anführungszeichen", () => {
    const csv = roleStatsCsv(stats);
    expect(csv.startsWith("﻿Rolle;Wörter;Anteil %")).toBe(true);
    expect(csv).toContain("Bastian;6;54,5;3;3;2");
    expect(toCsv([["a;b", 'sagt "hallo"']])).toBe('﻿"a;b";"sagt ""hallo"""\r\n');
  });
  it("Matrix markiert Erwähnte, Technik listet Stichwörter", () => {
    expect(matrixCsv(stats, "words")).toContain("Atreju;5;;1");
    const names = new Map(input.scenes.map((s) => [s.id, s.title]));
    expect(cueListCsv(stats, names)).toContain("Licht;1;LICHT 2 aus;Allein hier;Szene 2;1");
  });
});

describe("Gemessene Szenenzeiten", () => {
  it("nimmt die Messung aus der Szene und zeigt Sekunden", () => {
    const stats = computeScriptStats({
      ...input,
      scenes: input.scenes.map((s) => (s.id === "s2" ? { ...s, measuredSeconds: 750 } : s)),
    });
    expect(stats.scenes[1].duration).toEqual({ seconds: 750, estimated: false });
    expect(formatDuration(stats.scenes[1].duration)).toBe("12:30 min");
    expect(stats.duration.estimated).toBe(true);
  });
  it("liest Eingaben", () => {
    expect(parseDurationInput("12")).toBe(720);
    expect(parseDurationInput("12:30")).toBe(750);
    expect(parseDurationInput("1:02:05")).toBe(3725);
    expect(parseDurationInput(" 4 min")).toBe(240);
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("12:75")).toBeNaN();
    expect(parseDurationInput("abc")).toBeNaN();
  });
  it("erkennt gleiche Szenen trotz Schreibweise", () => {
    expect(sceneTitleKey("SZENE 2 – HERR  KOREANDER")).toBe(
      sceneTitleKey("szene 2 - Herr Koreander"),
    );
  });
});
