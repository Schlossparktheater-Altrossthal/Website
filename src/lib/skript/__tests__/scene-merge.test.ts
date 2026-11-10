import { describe, expect, it } from "vitest";

import { applyScriptFixes, SCRIPT_FIXES } from "@/lib/skript/fixes";
import { mergeSceneUpdate, sceneNumberKey } from "@/lib/skript/scene-merge";
import type { ScriptScene } from "@/lib/skript/types";

const scene = (title: string, text = title): ScriptScene => ({
  title,
  blocks: [{ kind: "speech", speaker: "Fix", page: 1, parts: [{ kind: "text", text }] }],
});
const base = [
  "PROLOG",
  "1. SZENE: A",
  "2. SZENE: B",
  "5. SZENE: C",
  "6. SZENE: D",
  "7. SZENE: E",
].map((t) => scene(t));

describe("Szenen-Teillieferung", () => {
  it("erkennt Szenennummern", () => {
    expect(sceneNumberKey("6. SZENE: AN DECK")).toBe("6");
    expect(sceneNumberKey("20.A SZENE: HAFEN")).toBe("20A");
    expect(sceneNumberKey("Szene 6")).toBe("6");
    expect(sceneNumberKey("PROLOG")).toBe("prolog");
  });

  it("ersetzt Szene 6 und sortiert eine neue Szene 3 ein", () => {
    const merged = mergeSceneUpdate(base, [scene("6. SZENE: D NEU", "neu"), scene("3. SZENE: X")]);
    expect(merged?.replaced).toEqual([{ from: "6. SZENE: D", to: "6. SZENE: D NEU" }]);
    expect(merged?.added).toEqual(["3. SZENE: X"]);
    expect(merged?.scenes.map((s) => s.title)).toEqual([
      "PROLOG",
      "1. SZENE: A",
      "2. SZENE: B",
      "3. SZENE: X",
      "5. SZENE: C",
      "6. SZENE: D NEU",
      "7. SZENE: E",
    ]);
  });

  it("vollständige Fassungen bleiben vollständig", () => {
    expect(mergeSceneUpdate(base, base)).toBeNull();
    expect(
      mergeSceneUpdate(base, [{ title: "(Vorspann)", blocks: [] }, scene("6. SZENE: D")]),
    ).toBeNull();
    expect(mergeSceneUpdate(base, [scene("9. SZENE: Z")])).toBeNull();
  });
});

describe("Anrede der Briten (80 Tage)", () => {
  it("ersetzt Madame/Monsieur nur im Text britischer Rollen, auch ohne Titelseite", () => {
    const scenes: ScriptScene[] = [
      {
        title: "6. SZENE: X",
        blocks: [
          {
            kind: "speech",
            speaker: "Fix",
            page: 1,
            parts: [
              { kind: "text", text: "Sie gestatten, Madame. Hallo, Monsieur Passepartout!" },
              { kind: "direction", text: "zu Madame" },
            ],
          },
          {
            kind: "speech",
            speaker: "Passepartout",
            page: 1,
            parts: [{ kind: "text", text: "Bonjour, Madame, Monsieur!" }],
          },
        ],
      },
    ];
    applyScriptFixes(scenes, [], SCRIPT_FIXES, "In 80 Tagen um die Welt");
    expect(scenes[0].blocks[0].parts.map((p) => p.text)).toEqual([
      "Sie gestatten, Miss. Hallo, Mister Passepartout!",
      "zu Madame",
    ]);
    expect(scenes[0].blocks[1].parts[0].text).toBe("Bonjour, Madame, Monsieur!");
  });
});
