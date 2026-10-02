import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/permissions", () => ({
  findUserIdsWithPermission: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));

import { leadStageFor, reminderText } from "@/lib/notifications/milestone-reminders";

describe("leadStageFor", () => {
  it("picks the stage by days until the deadline", () => {
    expect(leadStageFor(10)).toBeNull();
    expect(leadStageFor(7)).toBe("d7");
    expect(leadStageFor(3)).toBe("d7");
    expect(leadStageFor(2)).toBe("d2");
    expect(leadStageFor(0)).toBe("d2");
    expect(leadStageFor(-1)).toBe("overdue");
  });
});

describe("reminderText", () => {
  it("phrases the reminder per stage", () => {
    expect(reminderText("d7", "Bauabgabe", 7)).toBe("Frist in 7 Tagen: Bauabgabe");
    expect(reminderText("d2", "Bauabgabe", 0)).toBe("Frist heute: Bauabgabe");
    expect(reminderText("d2", "Bauabgabe", 1)).toBe("Frist in 1 Tag: Bauabgabe");
    expect(reminderText("overdue", "Bauabgabe", -2)).toBe("Überfällig: Bauabgabe");
  });
});
