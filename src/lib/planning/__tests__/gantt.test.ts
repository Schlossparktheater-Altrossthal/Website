import { describe, expect, it } from "vitest";

import {
  NO_DEPARTMENT,
  buildAxis,
  buildGanttRows,
  dependencyPath,
  isoWeek,
  milestoneSpan,
  weeklyDensity,
  type GanttMilestoneInput,
} from "@/lib/planning/gantt";
import { toDay } from "@/lib/planning/schedule";

const day = (iso: string) => toDay(new Date(`${iso}T00:00:00.000Z`));

function milestone(partial: Partial<GanttMilestoneInput> & { id: string }): GanttMilestoneInput {
  return {
    title: partial.id,
    dueDay: day("2027-03-01"),
    durationDays: 0,
    done: false,
    departmentId: null,
    tasks: [],
    ...partial,
  };
}

describe("milestoneSpan", () => {
  it("reicht von Frist minus Dauer bis zur Frist", () => {
    expect(milestoneSpan(100, 14)).toEqual({ start: 86, end: 100 });
    expect(milestoneSpan(100, 0)).toEqual({ start: 100, end: 100 });
    expect(milestoneSpan(100, -3)).toEqual({ start: 100, end: 100 });
  });
});

describe("buildGanttRows", () => {
  const groups = [
    { id: "technik", name: "Technik", color: "#00f" },
    { id: "kostuem", name: "Kostüm", color: null },
  ];
  const milestones = [
    milestone({ id: "b", departmentId: "technik", dueDay: day("2027-04-01"), durationDays: 10 }),
    milestone({ id: "a", departmentId: "technik", dueDay: day("2027-02-01") }),
    milestone({ id: "p", dueDay: day("2027-05-01"), done: true }),
    milestone({ id: "x", dueDay: null }),
    milestone({
      id: "t",
      departmentId: "kostuem",
      tasks: [{ id: "k1", title: "Hemd", dueDay: day("2027-02-20"), done: false }],
    }),
  ];

  it("gruppiert nach Gewerk, sortiert nach Frist und lässt Einträge ohne Datum weg", () => {
    const rows = buildGanttRows(milestones, groups, { collapsed: new Set(), expanded: new Set() });
    expect(rows.map((row) => row.key)).toEqual([
      "g:technik",
      "m:a",
      "m:b",
      "g:kostuem",
      "m:t",
      `g:${NO_DEPARTMENT}`,
      "m:p",
    ]);
    const group = rows[0];
    expect(group.type === "group" && group.span).toEqual({
      start: day("2027-02-01"),
      end: day("2027-04-01"),
    });
  });

  it("klappt Gruppen ein, Karten auf und filtert", () => {
    const rows = buildGanttRows(milestones, groups, {
      collapsed: new Set(["technik"]),
      expanded: new Set(["t"]),
      onlyOpen: true,
    });
    expect(rows.map((row) => row.key)).toEqual(["g:technik", "g:kostuem", "m:t", "t:k1"]);
    const filtered = buildGanttRows(milestones, groups, {
      collapsed: new Set(),
      expanded: new Set(),
      groupFilter: "kostuem",
    });
    expect(filtered.map((row) => row.key)).toEqual(["g:kostuem", "m:t"]);
  });
});

describe("Zeitachse", () => {
  it("berechnet ISO-Kalenderwochen", () => {
    expect(isoWeek(day("2027-01-04"))).toBe(1);
    expect(isoWeek(day("2026-12-31"))).toBe(53);
    expect(isoWeek(day("2026-10-30"))).toBe(44);
  });

  it("zeigt oben Jahre und unten Monate", () => {
    const axis = buildAxis(day("2026-11-15"), day("2027-02-10"), "month");
    expect(axis.top.map((cell) => cell.label)).toEqual(["2026", "2027"]);
    expect(axis.bottom).toHaveLength(4);
    expect(axis.bottom[0].start).toBe(day("2026-11-15"));
  });

  it("zeigt im Wochenzoom Kalenderwochen", () => {
    const axis = buildAxis(day("2026-11-02"), day("2026-11-15"), "week");
    expect(axis.bottom.map((cell) => cell.label)).toEqual(["KW 45", "KW 46"]);
  });

  it("zählt Proben je Woche", () => {
    const density = weeklyDensity([day("2026-11-02"), day("2026-11-04"), day("2026-11-10")]);
    expect(density.get(day("2026-11-02"))).toBe(2);
    expect(density.get(day("2026-11-09"))).toBe(1);
  });
});

describe("dependencyPath", () => {
  it("geht rechtwinklig nach rechts, wenn Platz ist", () => {
    expect(dependencyPath({ x: 10, y: 20 }, { x: 100, y: 60 }, 38)).toBe("M10,20 H18 V60 H100");
  });

  it("läuft in der Zeilenfuge zurück, wenn der Nachfolger früher beginnt", () => {
    expect(dependencyPath({ x: 100, y: 20 }, { x: 50, y: 58 }, 38)).toBe(
      "M100,20 H108 V39 H42 V58 H50",
    );
  });
});
