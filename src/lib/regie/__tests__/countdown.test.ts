import { describe, expect, it } from "vitest";

import { buildDirectionCountdown, type DirectionCountdownInput } from "@/lib/regie/countdown";

const at = (iso: string) => new Date(iso);
const base: DirectionCountdownInput = {
  now: at("2026-06-01T20:00:00Z"),
  finalRehearsalWeekStart: at("2026-06-29T00:00:00Z"),
  finalRehearsalWeekEnd: at("2026-07-04T00:00:00Z"),
  premiereAt: null,
  performances: [at("2026-07-05T17:00:00Z"), at("2026-07-11T17:00:00Z")],
  upcomingRehearsals: [at("2026-06-05T16:00:00Z"), at("2026-06-30T16:00:00Z")],
  sceneCount: 10,
  rehearsedSceneCount: 7,
};
const byKey = (input: DirectionCountdownInput) =>
  Object.fromEntries(buildDirectionCountdown(input).map((stat) => [stat.key, stat]));

describe("buildDirectionCountdown", () => {
  it("zählt Kalendertage bis Endproben und Premiere", () => {
    const stats = byKey(base);
    expect(stats.endproben.value).toBe("28");
    expect(stats.premiere.value).toBe("34");
    expect(stats.proben.value).toBe("2");
    expect(stats.proben.hint).toBe("1 vor der Endprobenwoche");
    expect(stats.szenen.value).toBe("3");
  });

  it("zeigt die laufende Endprobenwoche mit Tag x von y", () => {
    const stats = byKey({ ...base, now: at("2026-06-30T10:00:00Z") });
    expect(stats.endproben.value).toBe("Läuft");
    expect(stats.endproben.hint).toBe("Tag 2 von 6");
  });

  it("zählt nach der Premiere die übrigen Vorstellungen und blendet Proben aus", () => {
    const stats = byKey({ ...base, now: at("2026-07-06T10:00:00Z") });
    expect(stats.endproben).toBeUndefined();
    expect(stats.premiere.value).toBe("1 übrig");
    expect(stats.proben).toBeUndefined();
  });

  it("nimmt premiereAt, wenn keine Vorstellung angelegt ist", () => {
    const stats = byKey({
      ...base,
      performances: [],
      premiereAt: at("2026-06-03T18:00:00Z"),
      finalRehearsalWeekStart: null,
    });
    expect(stats.premiere.value).toBe("2");
    expect(stats.endproben.value).toBe("–");
  });
});
