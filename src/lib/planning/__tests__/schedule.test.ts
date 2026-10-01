import { describe, expect, it } from "vitest";

import {
  PlanCycleError,
  computeDueDates,
  computeSchedule,
  diffDueDates,
  findCycle,
  todayInTimeZone,
  type ScheduleMilestone,
} from "@/lib/planning/schedule";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const anchors = { premiereAt: d("2027-07-18"), finalRehearsalStart: d("2027-07-10") };
const now = new Date("2027-06-01T10:00:00.000Z");

const milestone = (id: string, rest: Partial<ScheduleMilestone> = {}): ScheduleMilestone => ({
  id,
  anchorType: "premiere",
  offsetDays: 0,
  ...rest,
});

describe("computeDueDates", () => {
  it("resolves premiere, final rehearsal, fixed and chained anchors", () => {
    const dates = computeDueDates(
      [
        milestone("gema", {
          anchorType: "milestone",
          anchorMilestoneId: "endprobe",
          offsetDays: -14,
        }),
        milestone("endprobe", { anchorType: "finalRehearsalStart" }),
        milestone("bau", { offsetDays: -30 }),
        milestone("plakat", { anchorType: "fixed", fixedDate: d("2027-03-01"), offsetDays: 5 }),
      ],
      anchors,
    );
    expect(dates.get("gema")).toEqual(d("2027-06-26"));
    expect(dates.get("endprobe")).toEqual(d("2027-07-10"));
    expect(dates.get("bau")).toEqual(d("2027-06-18"));
    expect(dates.get("plakat")).toEqual(d("2027-03-01"));
  });

  it("leaves dates empty without an anchor", () => {
    const dates = computeDueDates(
      [milestone("a"), milestone("b", { anchorType: "milestone", anchorMilestoneId: "a" })],
      { premiereAt: null, finalRehearsalStart: null },
    );
    expect(dates.get("a")).toBeNull();
    expect(dates.get("b")).toBeNull();
  });

  it("rejects circular anchors", () => {
    expect(() =>
      computeDueDates(
        [
          milestone("a", { anchorType: "milestone", anchorMilestoneId: "b" }),
          milestone("b", { anchorType: "milestone", anchorMilestoneId: "a" }),
        ],
        anchors,
      ),
    ).toThrow(PlanCycleError);
  });
});

describe("findCycle", () => {
  it("detects cycles across dependencies and anchors", () => {
    const cycle = findCycle(
      [milestone("a"), milestone("b", { anchorType: "milestone", anchorMilestoneId: "a" })],
      [{ fromId: "b", toId: "a", lagDays: 0 }],
    );
    expect(cycle).toEqual(["a", "b", "a"]);
  });

  it("returns null for a valid plan", () => {
    expect(
      findCycle([milestone("a"), milestone("b")], [{ fromId: "a", toId: "b", lagDays: 3 }]),
    ).toBeNull();
  });
});

describe("computeSchedule", () => {
  it("computes slack backwards and flags a chain without buffer as critical", () => {
    const schedule = computeSchedule(
      [
        milestone("bau", { offsetDays: -21 }),
        milestone("bauprobe", { offsetDays: -14 }),
        milestone("kostuem", { offsetDays: -60 }),
      ],
      [{ fromId: "bau", toId: "bauprobe", lagDays: 7 }],
      anchors,
      now,
    );
    // Bauprobe darf bis zur Premiere: 14 Tage Puffer; Bau muss 7 Tage davor fertig sein.
    expect(schedule.get("bauprobe")?.slackDays).toBe(14);
    expect(schedule.get("bauprobe")?.health).toBe("ok");
    expect(schedule.get("bau")?.latestAt).toEqual(d("2027-07-11"));
    expect(schedule.get("bau")?.slackDays).toBe(14);
    expect(schedule.get("kostuem")?.slackDays).toBe(60);
  });

  it("marks zero slack before an open successor as critical and low slack as warning", () => {
    const schedule = computeSchedule(
      [
        milestone("a", { offsetDays: -20 }),
        milestone("b", { offsetDays: -5 }),
        milestone("c", { offsetDays: -3 }),
      ],
      [{ fromId: "a", toId: "b", lagDays: 20 }],
      anchors,
      now,
    );
    expect(schedule.get("a")?.slackDays).toBe(0);
    expect(schedule.get("a")?.health).toBe("critical");
    expect(schedule.get("c")?.health).toBe("warning");
  });

  it("propagates delay from an overdue milestone to its successors", () => {
    const schedule = computeSchedule(
      [
        milestone("gema", { anchorType: "fixed", fixedDate: d("2027-05-20") }),
        milestone("druck", { anchorType: "fixed", fixedDate: d("2027-06-05") }),
        milestone("frei", { anchorType: "fixed", fixedDate: d("2027-06-30") }),
      ],
      [
        { fromId: "gema", toId: "druck", lagDays: 10 },
        { fromId: "gema", toId: "frei", lagDays: 10 },
      ],
      anchors,
      now,
    );
    expect(schedule.get("gema")?.health).toBe("overdue");
    expect(schedule.get("druck")?.projectedAt).toEqual(d("2027-06-11"));
    expect(schedule.get("druck")?.endangeredBy).toEqual(["gema"]);
    expect(schedule.get("druck")?.health).toBe("critical");
    // Genug Luft: kein Verzug, obwohl der Vorgänger überfällig ist.
    expect(schedule.get("frei")?.endangeredBy).toEqual([]);
  });

  it("ignores done milestones for delay and slack", () => {
    const schedule = computeSchedule(
      [
        milestone("gema", {
          anchorType: "fixed",
          fixedDate: d("2027-05-20"),
          doneAt: d("2027-05-19"),
        }),
        milestone("druck", { anchorType: "fixed", fixedDate: d("2027-06-05") }),
      ],
      [{ fromId: "gema", toId: "druck", lagDays: 10 }],
      anchors,
      now,
    );
    expect(schedule.get("gema")?.health).toBe("done");
    expect(schedule.get("druck")?.endangeredBy).toEqual([]);
  });

  it("does not bound milestones after the premiere and handles a missing anchor", () => {
    const schedule = computeSchedule(
      [
        milestone("abbau", { offsetDays: 10 }),
        milestone("x", { anchorType: "finalRehearsalStart" }),
      ],
      [],
      { premiereAt: d("2027-07-18"), finalRehearsalStart: null },
      now,
    );
    expect(schedule.get("abbau")?.slackDays).toBeNull();
    expect(schedule.get("abbau")?.health).toBe("ok");
    expect(schedule.get("x")?.health).toBe("unscheduled");
  });

  it("rejects cyclic dependencies", () => {
    expect(() =>
      computeSchedule(
        [milestone("a"), milestone("b")],
        [
          { fromId: "a", toId: "b", lagDays: 0 },
          { fromId: "b", toId: "a", lagDays: 0 },
        ],
        anchors,
        now,
      ),
    ).toThrow(PlanCycleError);
  });
});

describe("diffDueDates", () => {
  it("lists shifted milestones when the premiere moves", () => {
    const items = [
      milestone("a", { offsetDays: -10 }),
      milestone("fix", { anchorType: "fixed", fixedDate: d("2027-01-01") }),
    ];
    const before = computeDueDates(items, anchors);
    const after = computeDueDates(items, { ...anchors, premiereAt: d("2027-07-25") });
    expect(diffDueDates(before, after)).toEqual([
      { id: "a", from: d("2027-07-08"), to: d("2027-07-15"), shiftDays: 7 },
    ]);
  });
});

describe("todayInTimeZone", () => {
  it("uses the Berlin calendar day", () => {
    expect(todayInTimeZone(new Date("2027-06-01T22:30:00.000Z"))).toEqual(d("2027-06-02"));
  });
});
