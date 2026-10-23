import { describe, expect, it } from "vitest";

import { applyScriptFixes } from "@/lib/skript/fixes";
import type { ScriptScene } from "@/lib/skript/types";

const scenes = (): ScriptScene[] => [
  {
    title: "20. SZENE: HAFEN",
    blocks: [
      {
        kind: "direction",
        speaker: null,
        page: 1,
        parts: [
          { kind: "direction", text: "Passepartout agiert" },
          { kind: "text", text: "Meinen Dank, Passepartout" },
        ],
      },
    ],
  },
];

describe("skriptspezifische Korrekturen", () => {
  it("setzt Rolle, Szenentitel und Text nur bei passendem Vorspann", () => {
    const set = {
      name: "Test",
      match: /In 80 Tagen/,
      fixes: [
        { kind: "speaker" as const, startsWith: "Meinen Dank", speaker: "Fogg" },
        { kind: "scene" as const, title: "20. SZENE: HAFEN", to: "20.A SZENE: HAFEN" },
        { kind: "text" as const, from: "gibt es nicht", to: "x" },
      ],
    };
    const fixed = scenes();
    const result = applyScriptFixes(fixed, ["In 80 Tagen um die Welt"], [set]);
    expect(result.missed).toEqual(["Text „gibt es nicht“ → „x“"]);
    expect(fixed[0].title).toBe("20.A SZENE: HAFEN");
    expect(fixed[0].blocks.map((b) => [b.kind, b.speaker])).toEqual([
      ["direction", null],
      ["speech", "Fogg"],
    ]);

    const other = scenes();
    expect(applyScriptFixes(other, ["Die unendliche Geschichte"], [set]).applied).toEqual([]);
    expect(other[0].title).toBe("20. SZENE: HAFEN");
  });

  it("benennt Rollen um und macht fette Namen zu Regie", () => {
    const fixed: ScriptScene[] = [
      {
        title: "1",
        blocks: [
          {
            kind: "speech",
            speaker: "Earl Grey",
            page: 1,
            parts: [{ kind: "text", text: "Aber" }],
          },
          {
            kind: "speech",
            speaker: "Fogg und der Kapitän",
            page: 1,
            parts: [{ kind: "direction", text: "treten auf" }],
          },
        ],
      },
    ];
    const result = applyScriptFixes(
      fixed,
      ["x"],
      [
        {
          name: "Test",
          match: /x/,
          fixes: [
            { kind: "role", from: "Earl Grey", to: "Earl of Earl Grey" },
            { kind: "direction", speaker: "Fogg und der Kapitän" },
          ],
        },
      ],
    );
    expect(result.missed).toEqual([]);
    expect(fixed[0].blocks[0].speaker).toBe("Earl of Earl Grey");
    expect(fixed[0].blocks[1]).toMatchObject({
      kind: "direction",
      speaker: null,
      parts: [{ kind: "direction", text: "Fogg und der Kapitän treten auf" }],
    });
  });
});
