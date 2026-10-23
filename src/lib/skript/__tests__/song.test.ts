import { describe, expect, it } from "vitest";

import { isSpoken, speakerLabel } from "@/lib/skript/types";

describe("Liedtext", () => {
  it("zählt als gesprochen und wird mit Notenzeichen beschriftet", () => {
    expect(["speech", "song", "direction"].map((kind) => isSpoken(kind as never))).toEqual([
      true,
      true,
      false,
    ]);
    expect(speakerLabel({ kind: "song", speaker: "Alle" })).toBe("♪ Alle");
    expect(speakerLabel({ kind: "song", speaker: null })).toBe("♪ Lied");
    expect(speakerLabel({ kind: "speech", speaker: "Fogg" })).toBe("Fogg");
  });
});

describe("Liedtext im Lernmodus", () => {
  it("teilt Abschnitte an Strophenenden", async () => {
    const { tokenizeBlock } = await import("@/lib/skript/learn/chunks");
    const stanza = "I see trees of green\nRed roses too\nI see them bloom\nFor me and you";
    const { chunks } = tokenizeBlock([{ kind: "text", text: `${stanza}\n\n${stanza}` }]);
    expect(chunks.map((chunk) => chunk.words.length)).toEqual([16, 16]);
  });
});
