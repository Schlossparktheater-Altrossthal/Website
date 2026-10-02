import { describe, expect, it } from "vitest";

import { computeDueDates, findCycle } from "@/lib/planning/schedule";
import {
  SUGGESTED_TEMPLATE,
  buildTemplateItems,
  instantiateTemplate,
  templateItemsSchema,
} from "@/lib/planning/templates";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("buildTemplateItems", () => {
  it("keeps relative anchors and converts fixed dates to premiere offsets", () => {
    const items = buildTemplateItems(
      [
        {
          id: "a",
          title: "GEMA",
          description: null,
          kind: "deadline",
          departmentSlug: null,
          anchorType: "fixed",
          anchorMilestoneId: null,
          offsetDays: 0,
          fixedDate: d("2027-01-18"),
          predecessors: [],
        },
        {
          id: "b",
          title: "Druck",
          description: null,
          kind: "handover",
          departmentSlug: "werbung-social",
          anchorType: "milestone",
          anchorMilestoneId: "a",
          offsetDays: 14,
          fixedDate: null,
          predecessors: [{ fromId: "a", lagDays: 3 }],
        },
      ],
      { premiereAt: d("2027-07-18"), year: 2027 },
    );
    expect(items[0]).toMatchObject({ key: "m1", anchorType: "premiere", offsetDays: -181 });
    expect(items[1]).toMatchObject({
      anchorType: "milestone",
      anchorKey: "m1",
      predecessors: [{ key: "m1", lagDays: 3 }],
    });
    expect(templateItemsSchema.safeParse(items).success).toBe(true);
  });

  it("keeps fixed dates with source year when there is no premiere", () => {
    const [item] = buildTemplateItems(
      [
        {
          id: "a",
          title: "X",
          description: null,
          kind: "deadline",
          departmentSlug: null,
          anchorType: "fixed",
          anchorMilestoneId: null,
          offsetDays: 0,
          fixedDate: d("2027-03-01"),
          predecessors: [],
        },
      ],
      { premiereAt: null, year: 2027 },
    );
    expect(item).toMatchObject({ anchorType: "fixed", fixedDate: "2027-03-01", sourceYear: 2027 });
    const [planned] = instantiateTemplate([item], { year: 2028, departmentIdsBySlug: new Map() });
    expect(planned.fixedDate).toEqual(d("2028-03-01"));
  });
});

describe("instantiateTemplate", () => {
  it("maps department slugs and falls back for missing anchors", () => {
    const planned = instantiateTemplate(
      [
        {
          key: "x",
          title: "X",
          kind: "deadline",
          departmentSlug: "technik",
          anchorType: "milestone",
          anchorKey: "missing",
          offsetDays: -3,
          predecessors: [{ key: "missing", lagDays: 1 }],
        },
      ],
      { year: 2028, departmentIdsBySlug: new Map([["technik", "dep1"]]) },
    );
    expect(planned[0]).toMatchObject({
      departmentId: "dep1",
      anchorType: "premiere",
      anchorKey: null,
      predecessors: [],
    });
  });

  it("produces a valid, cycle-free suggestion", () => {
    const planned = instantiateTemplate(SUGGESTED_TEMPLATE.items, {
      year: 2027,
      departmentIdsBySlug: new Map(),
    });
    const milestones = planned.map((entry) => ({
      id: entry.key,
      anchorType: entry.anchorType,
      anchorMilestoneId: entry.anchorKey,
      offsetDays: entry.offsetDays,
      fixedDate: entry.fixedDate,
    }));
    const deps = planned.flatMap((entry) =>
      entry.predecessors.map((dep) => ({ fromId: dep.key, toId: entry.key, lagDays: dep.lagDays })),
    );
    expect(findCycle(milestones, deps)).toBeNull();
    const dates = computeDueDates(milestones, {
      premiereAt: d("2027-07-18"),
      finalRehearsalStart: d("2027-07-10"),
    });
    expect(dates.get("endprobe")).toEqual(d("2027-07-10"));
    expect(planned).toHaveLength(10);
  });
});
