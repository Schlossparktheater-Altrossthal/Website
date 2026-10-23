import { describe, expect, it } from "vitest";

import { extractLines } from "@/lib/skript/extract";
import { isPdf, parseScriptPdf } from "@/lib/skript/import";
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

describe("PDF-Erkennung", () => {
  it("erkennt PDFs am Kopf, auch mit Bytes davor", async () => {
    expect(isPdf(await buildScriptPdf([[[R("x")]]]))).toBe(true);
    expect(isPdf(new TextEncoder().encode("\n\n%PDF-1.7 …"))).toBe(true);
    expect(isPdf(new TextEncoder().encode("PK\u0003\u0004 docx"))).toBe(false);
  });

  it("liest Skripte mit fetter Rolle ohne Doppelpunkt (Profil bold-name)", async () => {
    const result = await parseScriptPdf(
      await buildScriptPdf([
        [
          [B("In 80 Tagen um die Welt")],
          [B("Die Personen"), R(": Fogg, Passepartout")],
          [B("1. SZENE: BEI FOGG ZUHAUSE")],
          [{ text: "Musik läuft aus", color: "#ee0000", style: "italic" }],
          [
            B("Fogg"),
            I(" mit Notizblock"),
            R(" Nun, mein Bester, Sie wissen, worum es sich handelt, ich musste"),
          ],
          [R("heute meinen Diener entlassen.")],
          [B("Passepartout!"), R(" Voila ier bin isch.")],
          [
            I("salutiert"),
            R(" The British Empire!"),
            { text: " Nebelstoß", color: "#7030a0", style: "italic" },
          ],
          [B("Hato"), R("r Sahib, bitte, sein still!")],
        ],
      ]),
    );
    expect(result.profile.id).toBe("bold-name");
    expect(result.scenes.map((s) => s.title)).toEqual(["(Vorspann)", "1. SZENE: BEI FOGG ZUHAUSE"]);
    expect(result.scenes[0].blocks.every((b) => b.speaker === null)).toBe(true);
    const [cue, fogg, passepartout, hator] = result.scenes[1].blocks;
    expect(cue.parts).toEqual([{ kind: "cue", category: "ton", text: "Musik läuft aus" }]);
    expect(fogg).toMatchObject({
      speaker: "Fogg",
      parts: [{ kind: "direction", text: "mit Notizblock" }, { kind: "text" }],
    });
    expect(passepartout.speaker).toBe("Passepartout");
    // Regie am Zeilenanfang gehört weiter zur Replik
    expect(passepartout.parts.map((p) => p.kind)).toEqual(["text", "direction", "text", "cue"]);
    expect(passepartout.parts.at(-1)).toMatchObject({ category: "nebel" });
    expect(hator).toMatchObject({
      speaker: "Hator",
      parts: [{ text: "Sahib, bitte, sein still!" }],
    });
  });

  it("erkennt Liedtext nach „singend“ mit Zeilen, Strophen und Sänger am Zeilenende", async () => {
    const result = await parseScriptPdf(
      await buildScriptPdf([
        [
          [B("1. SZENE: IM CLUB")],
          [
            B("Fogg"),
            R(" Good night, Gentlemen! Und nun singen wir alle zusammen ein schönes Lied."),
          ],
          [I("Alle kommen nach und nach singend auf die Bühne")],
          [I("I see trees of green")],
          [I("Red roses too")],
          [I("I see them bloom")],
          [I("I love you - "), B("Alle")],
          [I("I hear babies cry")],
          [R("Freeze")],
        ],
      ]),
    );
    const blocks = result.scenes.at(-1)!.blocks;
    const songs = blocks.filter((b) => b.kind === "song");
    expect(songs.map((b) => [b.speaker, b.parts[0].text])).toEqual([
      [null, "I see trees of green\nRed roses too\nI see them bloom"],
      ["Alle", "I love you"],
      [null, "I hear babies cry"],
    ]);
    expect(blocks.at(-1)).toMatchObject({ kind: "direction", parts: [{ text: "Freeze" }] });
  });
});
