import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  resolveDepartmentPermissionKeys,
  resolveMembershipKeys,
  type DepartmentOverride,
  type TemplateGrant,
} from "../permission-inheritance";

const templateGrants: TemplateGrant[] = [
  { templateId: "kostuem", role: "lead", key: "A" },
  { templateId: "kostuem", role: "lead", key: "B" },
  { templateId: "kostuem", role: "member", key: "A" },
  { templateId: "ton", role: "member", key: "C" },
];

describe("resolveMembershipKeys", () => {
  it("erbt die Rechte der Blaupause für die eigene Rolle", () => {
    const lead = resolveMembershipKeys(
      { departmentId: "k27", templateId: "kostuem", role: "lead" },
      templateGrants,
      [],
    );
    const guest = resolveMembershipKeys(
      { departmentId: "k27", templateId: "kostuem", role: "guest" },
      templateGrants,
      [],
    );
    expect([...lead].sort()).toEqual(["A", "B"]);
    expect(guest.size).toBe(0);
  });

  it("ergänzt grant und entzieht revoke nur im eigenen Gewerk", () => {
    const overrides: DepartmentOverride[] = [
      { departmentId: "k27", key: "B", mode: "revoke" },
      { departmentId: "k27", key: "D", mode: "grant" },
      { departmentId: "k26", key: "A", mode: "revoke" },
    ];
    const keys = resolveMembershipKeys(
      { departmentId: "k27", templateId: "kostuem", role: "lead" },
      templateGrants,
      overrides,
    );
    expect([...keys].sort()).toEqual(["A", "D"]);
  });

  it("revoke gewinnt gegen grant im selben Gewerk", () => {
    const keys = resolveMembershipKeys(
      { departmentId: "x", templateId: null, role: "member" },
      [],
      [
        { departmentId: "x", key: "E", mode: "revoke" },
        { departmentId: "x", key: "E", mode: "grant" },
      ],
    );
    expect(keys.has("E")).toBe(false);
  });

  it("Gewerk ohne Blaupause hat nur seine Abweichungen", () => {
    const keys = resolveMembershipKeys(
      { departmentId: "x", templateId: null, role: "lead" },
      templateGrants,
      [{ departmentId: "x", key: "F", mode: "grant" }],
    );
    expect([...keys]).toEqual(["F"]);
  });
});

describe("resolveDepartmentPermissionKeys", () => {
  it("vereinigt mehrere Gewerke; ein revoke in einem Gewerk wirkt nicht im anderen", () => {
    const keys = resolveDepartmentPermissionKeys(
      [
        { departmentId: "k27", templateId: "kostuem", role: "member" },
        { departmentId: "t27", templateId: "ton", role: "member" },
        { departmentId: "k26", templateId: "kostuem", role: "lead" },
      ],
      templateGrants,
      [{ departmentId: "k27", key: "A", mode: "revoke" }],
    );
    expect([...keys].sort()).toEqual(["A", "B", "C"]);
  });
});
