import { describe, expect, it } from "vitest";

import {
  MEMBERS_NAV_ASSIGNMENTS_GROUP_ID,
  MEMBERS_NAV_PRODUCTION_GROUP_ID,
  membersAssignmentsTodoItem,
} from "@/config/members-navigation";
import {
  filterMembersNavigationByPermissions,
  resolveAssignmentsGroupLabel,
  selectMembersNavigation,
  type ActiveProductionNavInfo,
} from "@/lib/members-navigation";

const BASE_PERMISSIONS = [
  "mitglieder.dashboard",
  "mitglieder.profil",
  "mitglieder.galerie",
  "mitglieder.sperrliste",
  "mitglieder.issues",
  "mitglieder.meine-proben",
  "mitglieder.meine-gewerke",
  "mitglieder.koerpermasse",
  "mitglieder.probenplanung",
  "mitglieder.endprobenwoche",
  "mitglieder.essenplanung",
  "mitglieder.produktionen",
];

describe("selectMembersNavigation", () => {
  it("injects department todo item when memberships are present", () => {
    const groups = selectMembersNavigation({ hasDepartmentMemberships: true });
    const assignments = groups.find((group) => group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID);

    expect(assignments).toBeDefined();
    const todoIndex = assignments!.items.findIndex(
      (item) => item.href === membersAssignmentsTodoItem.href,
    );
    const departmentsIndex = assignments!.items.findIndex(
      (item) => item.href === "/mitglieder/meine-gewerke",
    );

    expect(todoIndex).toBeGreaterThan(-1);
    expect(todoIndex).toBe(departmentsIndex + 1);
  });

  it("omits the department todo item without memberships", () => {
    const groups = selectMembersNavigation({ hasDepartmentMemberships: false });
    const assignments = groups.find((group) => group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID);

    expect(assignments).toBeDefined();
    const todoIndex = assignments!.items.findIndex(
      (item) => item.href === membersAssignmentsTodoItem.href,
    );

    expect(todoIndex).toBe(-1);
  });

  it("adds an active production shortcut with badge and aria label", () => {
    const activeProduction: ActiveProductionNavInfo = {
      id: "show-123",
      title: "Sommernachtstraum",
      year: 2025,
    };

    const groups = selectMembersNavigation({ activeProduction });
    const production = groups.find((group) => group.id === MEMBERS_NAV_PRODUCTION_GROUP_ID);

    expect(production).toBeDefined();
    const item = production!.items.find(
      (entry) => entry.href === `/mitglieder/produktionen/${activeProduction.id}`,
    );

    expect(item).toBeDefined();
    expect(item!.badge).toBe(String(activeProduction.year));
    expect(item!.ariaLabel).toContain(activeProduction.title!);
  });
});

describe("filterMembersNavigationByPermissions", () => {
  it("hides finance navigation for members without finance permissions", () => {
    const groups = selectMembersNavigation();
    const { groups: filtered } = filterMembersNavigationByPermissions(groups, BASE_PERMISSIONS);

    expect(filtered.some((group) => group.id === "finance")).toBe(false);
  });

  it("keeps only department related assignments for department-focused members", () => {
    const groups = selectMembersNavigation({ hasDepartmentMemberships: true });
    const permissions = ["mitglieder.meine-gewerke"] as const;
    const { groups: filtered } = filterMembersNavigationByPermissions(groups, permissions);
    const assignments = filtered.find((group) => group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID);

    expect(assignments).toBeDefined();
    const hrefs = assignments!.items.map((item) => item.href);
    expect(hrefs).toEqual([
      "/mitglieder/meine-gewerke",
      membersAssignmentsTodoItem.href,
    ]);
  });
});

describe("resolveAssignmentsGroupLabel", () => {
  it("returns 'Gewerke' when focus is departments", () => {
    expect(resolveAssignmentsGroupLabel("departments", [])).toBe("Gewerke");
  });

  it("infers label from permissions when focus is none", () => {
    expect(
      resolveAssignmentsGroupLabel("none", ["mitglieder.meine-gewerke", "mitglieder.meine-proben"]),
    ).toBe("Proben & Gewerke");
    expect(resolveAssignmentsGroupLabel("none", ["mitglieder.meine-gewerke"])).toBe("Gewerke");
    expect(resolveAssignmentsGroupLabel("none", [])).toBe("Proben");
  });
});
