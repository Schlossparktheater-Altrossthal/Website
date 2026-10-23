import { describe, expect, it } from "vitest";

import { parseLines, spansToParts, splitSpeaker } from "@/lib/skript/parse";
import { BOLD_NAME_PROFILE } from "@/lib/skript/profiles";
import type { TextLine, TextSpan } from "@/lib/skript/types";

const span = (text: string, bold = false, italic = false): TextSpan => ({
  text,
  bold,
  italic,
  color: null,
  highlight: null,
});

describe("splitSpeaker", () => {
  it("zieht am Bindestrich umbrochene Namen zusammen", () => {
    const r = splitSpeaker([span("Anführer- Demonstrant", true), span(" Los!")], BOLD_NAME_PROFILE);
    expect(r.speaker).toBe("Anführer-Demonstrant");
  });

  it("lässt Ergänzungsstriche vor „und“ stehen", () => {
    const r = splitSpeaker([span("Hin- und Rückweg", true), span(" Los!")], BOLD_NAME_PROFILE);
    expect(r.speaker).toBe("Hin- und Rückweg");
  });
});

describe("Satzzeichen und kursive Fragen", () => {
  it("hängt Satzzeichen am Anfang der Regie an den Satz davor", () => {
    const parts = spansToParts([span("Merde"), span("! zügig ab", false, true)], BOLD_NAME_PROFILE);
    expect(parts).toEqual([
      { kind: "text", text: "Merde!" },
      { kind: "direction", text: "zügig ab" },
    ]);
  });

  it("liest eine ganz kursive Frage als gesprochenen Text", () => {
    const line = (y: number, spans: TextSpan[]): TextLine => ({
      page: 1,
      y,
      x0: 50,
      x1: 300,
      spans,
    });
    const [scene] = parseLines(
      [
        line(10, [span("1. SZENE: IM ZUG", true)]),
        line(30, [span("Fogg ", true), span("Geht es Ihnen besser?", false, true)]),
      ],
      BOLD_NAME_PROFILE,
    ).slice(-1);
    expect(scene.blocks[0].parts).toEqual([{ kind: "text", text: "Geht es Ihnen besser?" }]);
  });
});
