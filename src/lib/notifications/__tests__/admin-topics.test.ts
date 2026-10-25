import { describe, expect, it } from "vitest";

import { shouldEmailInstantly } from "../preferences";
import { PREFERENCE_KEYS, adminTopicForType, preferenceKey } from "../types";

describe("Verwaltungs-Themen", () => {
  it("ordnet Verwaltungs-Hinweise ihrem Thema zu", () => {
    expect(preferenceKey("verwaltung", "photo-consent")).toBe("verwaltung:fotoerlaubnisse");
    expect(preferenceKey("verwaltung", "inventory-inspection")).toBe("verwaltung:lager");
    expect(adminTopicForType("rehearsal")).toBeNull();
  });

  it("lässt übrige Bereiche unverändert – auch die eigene Fotoerlaubnis-Erinnerung", () => {
    expect(preferenceKey("produktion", "photo-consent")).toBe("produktion");
  });

  it("kennt keinen Sammel-Schlüssel „verwaltung“", () => {
    expect(PREFERENCE_KEYS).not.toContain("verwaltung");
    expect(PREFERENCE_KEYS).toContain("verwaltung:auslagen");
  });
});

describe("shouldEmailInstantly mit Aufgaben-Schalter", () => {
  const action = { kind: "action" as const, priority: "normal" as const };
  const urgent = { kind: "action" as const, priority: "urgent" as const };

  it("schickt Aufgaben standardmäßig sofort", () => {
    expect(shouldEmailInstantly(action, "off")).toBe(true);
  });

  it("schickt keine Aufgaben-Mail, wenn abgeschaltet", () => {
    expect(shouldEmailInstantly(action, "instant", false, false)).toBe(false);
  });

  it("schickt Dringendes immer", () => {
    expect(shouldEmailInstantly(urgent, "off", false, false)).toBe(true);
  });
});
