import { describe, expect, it } from "vitest";

import { WISH_LEVELS, isTopWish, wishLevelOf } from "@/lib/wishes/levels";
import {
  canEditWishArea,
  computeFulfillment,
  shortAreaTitle,
  type WishlistPerson,
  type WishlistWish,
} from "@/lib/wishes/wishlist";

function person(id: string, wishes: Partial<WishlistWish>[], assigned = true): WishlistPerson {
  return {
    id,
    name: id,
    email: null,
    avatarSource: null,
    avatarUpdatedAt: null,
    focus: null,
    isReturning: false,
    onboardingDone: true,
    interests: [],
    memberSince: null,
    onboardingNote: null,
    note: null,
    wishes: wishes.map((wish, index) => ({
      areaCode: `a${index}`,
      weight: 40,
      level: 2,
      enteredBy: null,
      assigned: false,
      ...wish,
    })),
    departments: assigned ? ["Kostüm"] : [],
    roles: [],
  };
}

describe("wish levels", () => {
  it("maps weights onto the profile words", () => {
    expect(wishLevelOf(5)).toBe(1);
    expect(wishLevelOf(30)).toBe(2);
    expect(wishLevelOf(60)).toBe(3);
    expect(wishLevelOf(100)).toBe(4);
    for (const entry of WISH_LEVELS) expect(wishLevelOf(entry.weight)).toBe(entry.level);
  });

  it("treats the highest wish as top when nothing reaches 'Sehr gern'", () => {
    expect(isTopWish(60, 60)).toBe(true);
    expect(isTopWish(40, 40)).toBe(true);
    expect(isTopWish(20, 40)).toBe(false);
    expect(isTopWish(40, 90)).toBe(false);
  });
});

describe("computeFulfillment", () => {
  it("counts only assigned people with wishes", () => {
    const result = computeFulfillment([
      person("hit", [{ weight: 90, assigned: true }, { weight: 40 }]),
      person("miss", [{ weight: 90 }, { weight: 20, assigned: true }]),
      person("unassigned", [{ weight: 90 }], false),
      person("nowish", []),
    ]);
    expect(result).toEqual({ assigned: 2, fulfilled: 1, missedIds: ["miss"] });
  });
});

describe("canEditWishArea", () => {
  const crew = { domain: "crew" as const, departmentIds: ["d1"] };
  it("lets leads edit only their departments", () => {
    expect(canEditWishArea(crew, { manageAll: false, leadDepartmentIds: ["d1"] })).toBe(true);
    expect(canEditWishArea(crew, { manageAll: false, leadDepartmentIds: ["d2"] })).toBe(false);
    expect(
      canEditWishArea(
        { domain: "acting", departmentIds: [] },
        { manageAll: false, leadDepartmentIds: ["d1"] },
      ),
    ).toBe(false);
    expect(canEditWishArea(crew, { manageAll: true, leadDepartmentIds: [] })).toBe(true);
  });
});

describe("shortAreaTitle", () => {
  it("keeps the first part of compound titles", () => {
    expect(shortAreaTitle("Licht & Ton")).toBe("Licht");
    expect(shortAreaTitle("Bühnenbild & Ausstattung")).toBe("Bühnenbild");
  });
});
