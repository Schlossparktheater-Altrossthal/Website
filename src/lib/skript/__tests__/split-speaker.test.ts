import { describe, expect, it } from "vitest";

import { splitSpeaker } from "@/lib/skript/parse";
import { BOLD_NAME_PROFILE } from "@/lib/skript/profiles";
import type { TextSpan } from "@/lib/skript/types";

const span = (text: string, bold = false): TextSpan => ({
  text,
  bold,
  italic: false,
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
