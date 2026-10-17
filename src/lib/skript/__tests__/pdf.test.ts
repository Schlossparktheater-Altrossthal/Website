import { describe, expect, it } from "vitest";

import { renderPdfTemplate } from "@/lib/pdf/engine";

import { extractLines } from "../extract";
import { scriptPdfOptionsSchema } from "../pdf";
import { BOLD_COLON_PROFILE } from "../profiles";
import type { ScriptReaderData } from "../reader";

const data: ScriptReaderData = {
  version: {
    id: "v1",
    showId: "s1",
    label: "Stand 15.6.",
    status: "released",
    versionDate: null,
    showTitle: "Testgeschichte",
  },
  scenes: [{ id: "sc1", title: "Szene 1 – Wald", words: 9, minutes: 1, measuredSeconds: null }],
  roles: [
    { id: "a", name: "Atreju", lines: 1, words: 3, sceneIds: ["sc1"] },
    { id: "b", name: "Bastian", lines: 1, words: 6, sceneIds: ["sc1"] },
  ],
  ownRoleIds: [],
  credits: [
    { kind: "direction", label: "Regie", names: ["Elke Zeh"] },
    { kind: "adaptation", label: "Bühnenfassung", names: ["John von Düffel"] },
  ],
  people: [{ id: "u1", name: "Lisa Muster", roleIds: ["a"] }],
  viewerId: null,
  blocks: [
    {
      id: "1",
      lineageId: "l1",
      sceneId: "sc1",
      kind: "direction",
      speaker: null,
      roleIds: [],
      parts: [
        { kind: "cue", category: "licht", text: "LICHT 1 Wald" },
        { kind: "direction", text: "Nebel zieht auf." },
      ],
      words: 0,
      page: 1,
    },
    {
      id: "2",
      lineageId: "l2",
      sceneId: "sc1",
      kind: "speech",
      speaker: "Bastian",
      roleIds: ["b"],
      parts: [{ kind: "text", text: "Wo bin ich hier nur gelandet?" }],
      words: 6,
      page: 1,
    },
    {
      id: "3",
      lineageId: "l3",
      sceneId: "sc1",
      kind: "speech",
      speaker: "Atreju",
      roleIds: ["a"],
      parts: [
        { kind: "text", text: "In Phantásien." },
        { kind: "cue", category: "ton", text: "TON 2 Donner" },
      ],
      words: 3,
      page: 1,
    },
  ],
};

async function render(options: Partial<Record<string, unknown>>, personName?: string) {
  const parsed = scriptPdfOptionsSchema.parse(options);
  const result = await renderPdfTemplate("skript-fassung", {
    title: "Testgeschichte",
    data,
    options: parsed,
    personName,
  });
  const lines = await extractLines(new Uint8Array(result.buffer), BOLD_COLON_PROFILE);
  return { result, text: lines.map((line) => line.spans.map((s) => s.text).join("")) };
}

describe("Skript-PDF", () => {
  it("rendert Auswertungen als eigene Abschnitte mit Inhaltsverzeichnis", async () => {
    const { text } = await render({
      roleIds: ["a"],
      sections: ["roleStats", "sceneTable", "matrix", "cueList", "cueScript", "script"],
    });
    const all = text.join("\n");
    for (const expected of [
      "INHALT",
      "Rollen in Zahlen",
      "Szenenübersicht",
      "Auftritte",
      "Technik-Fahrplan",
      "Stichwortheft",
      "Licht 1",
      "LICHT 1 Wald",
      "Ton 1",
      "…Wo bin ich hier nur gelandet?",
      "Wo bin ich hier nur gelandet?",
    ]) {
      expect(all).toContain(expected);
    }
    const onlyStats = (await render({ sections: ["roleStats"] })).text.join("\n");
    expect(onlyStats).toContain("Rollen in Zahlen");
    expect(onlyStats).not.toContain("In Phantásien.");
  }, 30_000);

  it("Deckblatt nennt Mitwirkende sowie Person und Rolle einer persönlichen Fassung", async () => {
    const { text } = await render({ roleIds: ["a"], personId: "u1" }, "Lisa Muster");
    const all = text.join("\n");
    expect(all).toContain("Bühnenfassung John von Düffel");
    expect(all).toContain("Regie Elke Zeh");
    expect(all).toContain("Lisa Muster");
    expect(all).toContain("Rolle: Atreju");
    expect(all).toContain("für Lisa Muster");
    const onlyRole = (await render({ roleIds: ["a"], personShow: "role" }, "Lisa Muster")).text;
    expect(onlyRole.join("\n")).not.toContain("Lisa Muster");
  }, 30_000);

  it("enthält Titel, Szene, Sprecher, Text und Hinweise", async () => {
    const { result, text } = await render({});
    expect(result.filename).toBe("skript-testgeschichte-stand-15-6.pdf");
    const joined = text.join("\n");
    expect(joined).toContain("Testgeschichte");
    expect(joined).toContain("SZENE 1 – WALD");
    expect(joined).toContain("BASTIAN");
    expect(joined).toContain("In Phantásien.");
    expect(joined).toContain("[LICHT 1 Wald]");
    expect(joined).toContain("Nebel zieht auf.");
    expect(joined).toContain("1 / 1");
  });

  it("lässt ausgeblendete Hinweise und Regie weg und nennt die Rolle im Kopf", async () => {
    const { text } = await render({ hiddenCues: ["ton"], directions: "hide", roleIds: ["a"] });
    const joined = text.join("\n");
    expect(joined).not.toContain("TON 2 Donner");
    expect(joined).not.toContain("Nebel zieht auf.");
    expect(joined).toContain("[LICHT 1 Wald]");
    expect(joined).toContain("FASSUNG FÜR");
    expect(joined).toContain("Atreju");
  });

  it("setzt den Szenenkopf als Kasten: Wer, Mein Teil, Technik nummeriert", async () => {
    const { text } = await render({
      roleIds: ["a"],
      hiddenCues: ["ton"],
      sceneHeader: ["roles", "mine", "cues", "notes"],
    });
    const joined = text.join("\n");
    expect(joined).toContain("WERAtreju, Bastian");
    expect(joined).toContain("MEIN TEIL");
    // Eigene Nummer aus dem Skript („LICHT 1“) – keine zweite automatische davor.
    expect(joined).toContain("LICHTLICHT 1 Wald S. 1");
    // Ausgeblendetes Gewerk fehlt auch im Kopf.
    expect(joined).not.toContain("T1");
  });

  it("druckt eigene Notizen: Nummer im Text, Notiz darunter, Pause als Zeichen", async () => {
    const parsed = scriptPdfOptionsSchema.parse({ cover: false, notes: true });
    const base = {
      strokes: [],
      color: null,
      quote: null,
      state: "ok" as const,
      blockId: "2",
      partIndex: 0,
    };
    const result = await renderPdfTemplate("skript-fassung", {
      title: "Testgeschichte",
      data,
      options: parsed,
      notes: [
        { ...base, id: "n1", kind: "note", sign: null, body: "Hier stocken", start: 0, end: 2 },
        { ...base, id: "n2", kind: "sign", sign: "pause", body: null, start: 6, end: 6 },
      ],
    });
    const lines = await extractLines(new Uint8Array(result.buffer), BOLD_COLON_PROFILE);
    const joined = lines.map((line) => line.spans.map((s) => s.text).join("")).join("\n");
    expect(joined).toContain("[1] Hier stocken");
    expect(joined).toMatch(/Wo\s*\[1\]\s*bin/);
    expect(joined).toMatch(/bin\s*\/\s*ich/);
  });

  it("ohne Szenenkopf-Parameter kein Kasten", async () => {
    const { text } = await render({ roleIds: ["a"] });
    expect(text.join("\n")).not.toContain("MEIN TEIL");
  });

  it("Deckblatt mit Szenenverzeichnis, Seitenzählung ohne Deckblatt", async () => {
    const { text } = await render({});
    const joined = text.join("\n");
    expect(joined).toContain("SZENEN");
    expect(joined).toMatch(/Szene 1 – Wald\s*1/);
    expect(joined).toContain("1 / 1");
  });

  it("ohne Deckblatt steht der Titel über dem Text", async () => {
    const { text } = await render({ cover: false, roleIds: ["a"] });
    const joined = text.join("\n");
    expect(joined).not.toContain("SZENEN");
    expect(joined).toContain("Hervorgehoben: Atreju");
  });
});
