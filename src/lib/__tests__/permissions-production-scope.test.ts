import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isProductionScopedPermission, scopeSystemRolesToProduction } from "@/lib/permissions";

describe("scopeSystemRolesToProduction", () => {
  it("drops mirrored production roles when the member is not in the production", () => {
    expect(scopeSystemRolesToProduction(["member", "tech"], null)).toEqual(["member"]);
  });

  it("uses only the roles of the given production", () => {
    expect(scopeSystemRolesToProduction(["member", "cast", "tech"], ["cast"])).toEqual([
      "member",
      "cast",
    ]);
  });

  it("keeps global roles in every production", () => {
    expect(scopeSystemRolesToProduction(["board", "finance", "tech"], [])).toEqual([
      "board",
      "finance",
    ]);
  });
});

describe("isProductionScopedPermission", () => {
  it("scopes rehearsal planning but not administration", () => {
    expect(isProductionScopedPermission("PRIVATE.REHEARSAL.PLANNING.MANAGE")).toBe(true);
    expect(isProductionScopedPermission("PRIVATE.ADMIN.MEMBERS.MANAGE")).toBe(false);
  });
});
