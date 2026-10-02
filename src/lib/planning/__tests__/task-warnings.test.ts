import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/permissions", () => ({ hasPermission: vi.fn() }));

import { applyTaskWarnings } from "@/lib/planning/plan-service";

describe("applyTaskWarnings", () => {
  it("turns green into yellow when little buffer meets slow card progress", () => {
    const result = applyTaskWarnings("ok", {
      bufferDays: 3,
      tasksTotal: 9,
      tasksDone: 2,
      lateTasks: 0,
    });
    expect(result.health).toBe("warning");
    expect(result.warnings[0]).toContain("2 von 9");
  });

  it("stays green with enough buffer or enough progress", () => {
    expect(
      applyTaskWarnings("ok", { bufferDays: 20, tasksTotal: 9, tasksDone: 0, lateTasks: 0 }).health,
    ).toBe("ok");
    expect(
      applyTaskWarnings("ok", { bufferDays: 3, tasksTotal: 4, tasksDone: 2, lateTasks: 0 }).health,
    ).toBe("ok");
    expect(
      applyTaskWarnings("ok", { bufferDays: 3, tasksTotal: 0, tasksDone: 0, lateTasks: 0 }).health,
    ).toBe("ok");
  });

  it("warns about cards due after the milestone and never downgrades red", () => {
    expect(
      applyTaskWarnings("ok", { bufferDays: 30, tasksTotal: 2, tasksDone: 1, lateTasks: 1 }).health,
    ).toBe("warning");
    const critical = applyTaskWarnings("critical", {
      bufferDays: 1,
      tasksTotal: 5,
      tasksDone: 0,
      lateTasks: 2,
    });
    expect(critical.health).toBe("critical");
    expect(critical.warnings).toHaveLength(2);
  });
});
