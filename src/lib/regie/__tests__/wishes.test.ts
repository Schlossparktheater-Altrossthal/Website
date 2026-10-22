import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/regie/access", () => ({ getDirectionShows: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn(),
  findUserIdsWithPermission: vi.fn(),
}));

import { aggregateWishStatus, allowedTargetStatuses, type WishViewer } from "@/lib/regie/wishes";

const viewer = (patch: Partial<WishViewer> = {}): WishViewer => ({
  userId: "u1",
  showId: "s1",
  direction: false,
  planner: false,
  departments: new Map(),
  characterIds: new Set(),
  ...patch,
});
const target = (
  kind: "planning" | "department" | "character" | "user",
  id: string | null = null,
) => ({
  kind,
  departmentId: kind === "department" ? id : null,
  characterId: kind === "character" ? id : null,
  userId: kind === "user" ? id : null,
});

describe("aggregateWishStatus", () => {
  it("bleibt offen, solange ein Empfänger offen ist", () => {
    expect(aggregateWishStatus(["done", "open"])).toBe("open");
  });
  it("ist in Arbeit, wenn alle angenommen oder fertig sind", () => {
    expect(aggregateWishStatus(["accepted", "done"])).toBe("planned");
  });
  it("ist erledigt, wenn alle fertig sind und mindestens einer erledigt hat", () => {
    expect(aggregateWishStatus(["done", "declined"])).toBe("done");
    expect(aggregateWishStatus(["declined"])).toBe("declined");
  });
});

describe("allowedTargetStatuses", () => {
  it("Gewerk: Mitglied darf annehmen und erledigen, aber nicht ablehnen", () => {
    const v = viewer({ departments: new Map([["d1", { edit: true, lead: false }]]) });
    const allowed = allowedTargetStatuses(v, target("department", "d1"));
    expect(allowed).toEqual(expect.arrayContaining(["accepted", "done"]));
    expect(allowed).not.toContain("declined");
  });
  it("Gewerk: Leitung darf ablehnen", () => {
    const v = viewer({ departments: new Map([["d1", { edit: true, lead: true }]]) });
    expect(allowedTargetStatuses(v, target("department", "d1"))).toContain("declined");
  });
  it("Gast im Gewerk darf nichts", () => {
    const v = viewer({ departments: new Map([["d1", { edit: false, lead: false }]]) });
    expect(allowedTargetStatuses(v, target("department", "d1"))).toEqual([]);
  });
  it("Darsteller der Rolle darf ablehnen", () => {
    const v = viewer({ characterIds: new Set(["c1"]) });
    expect(allowedTargetStatuses(v, target("character", "c1"))).toContain("declined");
    expect(allowedTargetStatuses(v, target("character", "c2"))).toEqual([]);
  });
  it("Person darf nur Wünsche an sich selbst bearbeiten", () => {
    expect(allowedTargetStatuses(viewer(), target("user", "u1"))).toContain("done");
    expect(allowedTargetStatuses(viewer(), target("user", "u2"))).toEqual([]);
  });
  it("Regieteam darf nur wieder öffnen (und Planung erledigen)", () => {
    const v = viewer({ direction: true });
    expect(allowedTargetStatuses(v, target("department", "d1"))).toEqual(["open"]);
    expect(allowedTargetStatuses(v, target("planning")).sort()).toEqual(["done", "open"]);
  });
});
