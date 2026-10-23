import { describe, expect, it } from "vitest";

import { formatSceneLabel, formatSceneShort } from "@/lib/produktionen/scenes";

describe("Szenen-Bezeichnung", () => {
  it("kombiniert Kürzel und Titel", () => {
    expect(formatSceneLabel({ identifier: "1.3", title: "Im Wald" })).toBe("1.3 Im Wald");
    expect(formatSceneLabel({ identifier: "1.3", title: null })).toBe("1.3");
    expect(formatSceneLabel({ identifier: "", title: "Im Wald" })).toBe("Im Wald");
    expect(formatSceneLabel({ identifier: null, title: null })).toBe("Szene");
  });

  it("liefert die Kurzform", () => {
    expect(formatSceneShort({ identifier: "1.3", title: "Im Wald" })).toBe("1.3");
    expect(formatSceneShort({ identifier: "", title: "Im Wald" })).toBe("Im Wald");
    expect(formatSceneShort({ identifier: null, title: null }, "Szene")).toBe("Szene");
  });
});
