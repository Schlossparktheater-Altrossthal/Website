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

describe("selectMembersNavigation", () => {
  it("keeps the department todo item next to the Gewerke overview", () => {
    const groups = selectMembersNavigation();
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
  it("keeps only department related assignments for department-focused members", () => {
    const groups = selectMembersNavigation();
    const permissions = ["PRIVATE.DEPARTMENT.OWN.VIEW"] as const;
    const { groups: filtered } = filterMembersNavigationByPermissions(groups, permissions, {
      isDepartmentLead: true,
    });
    const assignments = filtered.find((group) => group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID);

    expect(assignments).toBeDefined();
    const hrefs = assignments!.items.map((item) => item.href);
    expect(hrefs).toEqual(["/mitglieder/meine-gewerke", membersAssignmentsTodoItem.href]);
  });
});

describe("resolveAssignmentsGroupLabel", () => {
  it("returns 'Gewerke' when focus is departments", () => {
    expect(resolveAssignmentsGroupLabel("departments", [])).toBe("Gewerke");
  });

  it("infers label from permissions when focus is none", () => {
    expect(
      resolveAssignmentsGroupLabel("none", [
        "PRIVATE.DEPARTMENT.OWN.VIEW",
        "PRIVATE.REHEARSAL.OWN.VIEW",
      ]),
    ).toBe("Gewerke");
    expect(resolveAssignmentsGroupLabel("none", ["PRIVATE.DEPARTMENT.OWN.VIEW"])).toBe("Gewerke");
    expect(resolveAssignmentsGroupLabel("none", ["PRIVATE.REHEARSAL.OWN.VIEW"])).toBe("Proben");
    expect(resolveAssignmentsGroupLabel("none", [])).toBe("Proben");
  });
});
