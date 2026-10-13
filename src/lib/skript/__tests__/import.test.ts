import { describe, expect, it } from "vitest";

import { extractLines } from "@/lib/skript/extract";
import { parseScriptPdf } from "@/lib/skript/import";
import { BOLD_COLON_PROFILE } from "@/lib/skript/profiles";

import { buildScriptPdf, type FixtureLine } from "./fixture-pdf";

const B = (text: string) => ({ text, style: "bold" as const });
const I = (text: string) => ({ text, style: "italic" as const });
const R = (text: string) => ({ text });

const PAGE_1: FixtureLine[] = [
  [B("SZENE 1 – IM LADEN")],
  [{ text: "TON 1 Glocke", highlight: "#ffff00" }, R(" "), I("Bastian tritt ein.")],
  [B("Koreander:"), R(" "), I("von hinten"), R(" Tür zu, es zieht!")],
  [B("Bastian:"), R(" Entschuldigung.")],
  [B("KOREANDER"), R(": Du störst, Junge. Und wenn sie mal eine Chance auf etwas haben, dann")],
  [R("kleben sie Kaugummi unter die Sitze.")],
];

const PAGE_2: FixtureLine[] = [
  [B("Bastian:"), R(" Tot. "), B("Koreander:"), R(" Hättest du nicht woanders hingehen können?")],
  [B("Koreandr:"), R(" Raus hier! Es ist anders als Deine Bücher – TON 2b: Luftzug und Tür zu")],
  [{ text: "Licht aus", highlight: "#00ffff", style: "italic" }],
  [B("SZENE 2 – PHANTÁSIEN")],
  [{ text: "Umbau durch Umbaugeister", color: "#ee0000", style: "italic" }],
  [B("Alle"), I(" flüsternd"), R(" TU WAS DU WILLST")],
  [B("Alle:"), R(" Ja!")],
];

describe("Skript-Import aus PDF", () => {
  it("liest Schriftschnitt, Markierung und Seite und filtert die Seitenzahl unten rechts", async () => {
    const pdf = await buildScriptPdf([PAGE_1]);
    const lines = await extractLines(pdf, BOLD_COLON_PROFILE);
    expect(
      lines.map((l) =>
        l.spans
          .map((s) => s.text)
          .join("")
          .trim(),
      ),
    ).not.toContain("1");
    const cue = lines[1].spans.find((s) => s.text.includes("TON 1"));
    expect(cue?.highlight).toBe("yellow");
    const speaker = lines[2].spans[0];
    expect(speaker).toMatchObject({ bold: true, italic: false });
    expect(speaker.text.trim()).toBe("Koreander:");
    expect(lines[2].spans.find((s) => s.italic)?.text.trim()).toBe("von hinten");
  });

  it("baut Szenen, Repliken, Regie und Hinweise", async () => {
    const result = await parseScriptPdf(await buildScriptPdf([PAGE_1, PAGE_2]));
    expect(result.profile.id).toBe("bold-colon");
    expect(result.scenes.map((s) => s.title)).toEqual([
      "SZENE 1 – IM LADEN",
      "SZENE 2 – PHANTÁSIEN",
    ]);

    const [first, second] = result.scenes;
    expect(first.blocks[0]).toMatchObject({
      kind: "direction",
      parts: [
        { kind: "cue", category: "ton", text: "TON 1 Glocke" },
        { kind: "direction", text: "Bastian tritt ein." },
      ],
    });
    expect(first.blocks[1]).toMatchObject({
      speaker: "Koreander",
      parts: [
        { kind: "direction", text: "von hinten" },
        { kind: "text", text: "Tür zu, es zieht!" },
      ],
    });
    // Zeilenumbruch innerhalb einer Replik, Großschreibung zusammengeführt
    expect(first.blocks[3]).toMatchObject({ speaker: "Koreander" });
    expect(first.blocks[3].parts[0].text).toContain("kleben sie Kaugummi");
    expect(result.mergedRoles.get("KOREANDER")).toBe("Koreander");

    // Sprecherwechsel mitten in der Zeile
    expect(first.blocks[4]).toMatchObject({ speaker: "Bastian", parts: [{ text: "Tot." }] });
    expect(first.blocks[5]).toMatchObject({ speaker: "Koreander" });

    // unmarkierter Hinweis im Text → unsicher
    const typo = first.blocks[6];
    expect(typo.parts).toContainEqual({
      kind: "cue",
      category: "ton",
      text: "TON 2b: Luftzug und Tür zu",
      auto: true,
    });
    expect(result.uncertainCues).toBe(1);
    expect(result.roleTypos.map((t) => [t.name, t.similarTo])).toContainEqual([
      "Koreandr",
      "Koreander",
    ]);

    // rote Schrift = Umbau; fetter Name ohne Doppelpunkt nur, wenn die Rolle bekannt ist
    expect(second.blocks[0].parts[0]).toMatchObject({ kind: "cue", category: "umbau" });
    expect(second.blocks[1]).toMatchObject({ speaker: "Alle", kind: "speech" });
  });
});
