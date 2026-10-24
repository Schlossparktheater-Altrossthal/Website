import { describe, expect, it } from "vitest";

import { MEMBERS_NAV_PRODUCTION_GROUP_ID } from "@/config/members-navigation";
import {
  filterMembersNavigationByPermissions,
  flattenSmallMembersNavigation,
  selectMembersNavigation,
  type ActiveProductionNavInfo,
} from "@/lib/members-navigation";

describe("selectMembersNavigation", () => {
  it("adds an active production shortcut with badge and aria label", () => {
    const activeProduction: ActiveProductionNavInfo = {
      id: "show-123",
      title: "Sommernachtstraum",
      year: 2025,
    };

    const groups = selectMembersNavigation({ activeProduction });
    const production = groups.find((group) => group.id === MEMBERS_NAV_PRODUCTION_GROUP_ID);

    expect(production).toBeDefined();
    const item = production!.items.find((entry) => entry.href === "/mitglieder/produktionen");

    expect(item).toBeDefined();
    expect(item!.badge).toBe(String(activeProduction.year));
    expect(item!.ariaLabel).toContain(activeProduction.title!);
  });
});

describe("filterMembersNavigationByPermissions", () => {
  it("shows the assignment page to department leads", () => {
    const { groups: filtered } = filterMembersNavigationByPermissions(
      selectMembersNavigation(),
      ["PRIVATE.DEPARTMENT.OWN.VIEW"],
      { isDepartmentLead: true },
    );
    const hrefs = filtered.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toEqual(["/mitglieder/meine-gewerke", "/mitglieder/produktionen/zuweisung"]);
  });

  it("hides the assignment page from members who do not lead a department", () => {
    const { groups: filtered } = filterMembersNavigationByPermissions(
      selectMembersNavigation(),
      ["PRIVATE.DEPARTMENT.OWN.VIEW"],
      { isDepartmentLead: false },
    );
    const hrefs = filtered.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).not.toContain("/mitglieder/produktionen/zuweisung");
  });
});

describe("flattenSmallMembersNavigation", () => {
  const ensemble = [
    "PRIVATE.DASHBOARD.OVERVIEW.VIEW",
    "PRIVATE.REHEARSAL.OWN.VIEW",
    "PRIVATE.PROFILE.OWN.VIEW",
    "PRIVATE.DEPARTMENT.OWN.VIEW",
  ];

  it("merges a short menu into one list without headings", () => {
    const { groups } = filterMembersNavigationByPermissions(selectMembersNavigation(), ensemble);
    const flat = flattenSmallMembersNavigation(groups);
    expect(flat).toHaveLength(1);
    expect(flat[0]!.label).toBe("");
    expect(flat[0]!.items.map((item) => item.label)).toContain("Profil");
  });

  it("keeps the groups for long menus", () => {
    const { groups } = filterMembersNavigationByPermissions(selectMembersNavigation(), undefined);
    expect(flattenSmallMembersNavigation(groups)).toEqual(groups);
  });
});
