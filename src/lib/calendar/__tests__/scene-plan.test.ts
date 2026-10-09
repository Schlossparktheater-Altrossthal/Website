import { describe, expect, it } from "vitest";

import { buildScenePlan } from "@/lib/calendar/scene-plan";

describe("buildScenePlan", () => {
  const plan = buildScenePlan({
    scenes: [
      { id: "a", label: "Sz. 1" },
      { id: "b", label: "Sz. 2" },
    ],
    entries: [
      { sceneId: "a", eventId: "e1", dayKey: "2026-10-01", done: true },
      { sceneId: "a", eventId: "e2", dayKey: "2026-10-15", done: false },
      { sceneId: "b", eventId: "e3", dayKey: "2026-09-10", done: true },
    ],
    todayKey: "2026-10-08",
    premiereKey: "2026-12-05",
  });

  it("spans four weeks back to the premiere week", () => {
    expect(plan.weeks[0]?.from).toBe("2026-09-07");
    expect(plan.weeks.at(-1)).toMatchObject({ from: "2026-11-30", premiere: true });
    expect(plan.weeks.find((week) => week.current)?.label).toBe("KW 41");
  });

  it("fills cells and counts rehearsals since the last time", () => {
    const [a, b] = plan.rows;
    expect(a?.cells[3]).toEqual({ done: 1, planned: 0, dayKeys: ["2026-10-01"] });
    expect(a).toMatchObject({ done: 1, planned: 1, nextPlanned: "2026-10-15", behind: [] });
    expect(b).toMatchObject({ lastDone: "2026-09-10", blocksSince: 1, daysSince: 28 });
    expect(plan.summary).toMatchObject({ rehearsals: 2, weeks: 2 });
  });

  it("measures 'behind' by the production's rhythm, not by days", () => {
    // Nur alle drei Wochen eine Probe: Szene b ist 3 Proben her, Szene a nie geprobt.
    const sparse = buildScenePlan({
      scenes: [
        { id: "a", label: "Sz. 1" },
        { id: "b", label: "Sz. 2" },
        { id: "c", label: "Sz. 3" },
      ],
      entries: [
        { sceneId: "b", eventId: "e1", dayKey: "2026-08-01", done: true },
        { sceneId: "c", eventId: "e1", dayKey: "2026-08-01", done: true },
        { sceneId: "c", eventId: "e2", dayKey: "2026-08-22", done: true },
        { sceneId: "c", eventId: "e3", dayKey: "2026-09-12", done: true },
        { sceneId: "c", eventId: "e4", dayKey: "2026-10-03", done: true },
        { sceneId: "b", eventId: "e4", dayKey: "2026-10-03", done: true },
      ],
      todayKey: "2026-10-08",
      premiereKey: null,
    });
    const [a, b, c] = sparse.rows;
    expect(a?.behind).toEqual(["long", "rare"]);
    // Vor fünf Tagen zuletzt – trotz seltener Proben nicht „lange her“.
    expect(b).toMatchObject({ blocksSince: 0, behind: [] });
    expect(c?.behind).toEqual([]);
  });

  it("counts a weekend of core days as one block", () => {
    // Fr/Sa/So geprobt, Szene b nur am Freitag: noch dieselbe Probenwoche, nicht „3 Proben her“.
    const weekend = buildScenePlan({
      scenes: [
        { id: "a", label: "Sz. 1" },
        { id: "b", label: "Sz. 2" },
      ],
      entries: [
        { sceneId: "a", eventId: "fr", dayKey: "2026-10-02", done: true },
        { sceneId: "b", eventId: "fr", dayKey: "2026-10-02", done: true },
        { sceneId: "a", eventId: "sa", dayKey: "2026-10-03", done: true },
        { sceneId: "a", eventId: "so", dayKey: "2026-10-04", done: true },
      ],
      todayKey: "2026-10-08",
      premiereKey: null,
    });
    expect(weekend.summary).toMatchObject({ rehearsals: 3, weeks: 1 });
    expect(weekend.rows[1]).toMatchObject({ blocksSince: 0 });
    expect(weekend.rows[1]?.behind).not.toContain("long");
  });
});
