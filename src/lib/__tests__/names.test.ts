import { describe, expect, it } from "vitest";

import { compareMembersByName, parseNameSortOrder } from "@/lib/names";

const people = [
  { firstName: "Clara", lastName: "Albrecht" },
  { firstName: "anna", lastName: "Zander" },
  { firstName: null, lastName: null, name: "Bernd" },
];

describe("compareMembersByName", () => {
  it("sortiert standardmäßig nach Vorname", () => {
    const sorted = [...people].sort(compareMembersByName(parseNameSortOrder(undefined)));
    expect(sorted.map((p) => p.firstName ?? p.name)).toEqual(["anna", "Bernd", "Clara"]);
  });

  it("sortiert auf Wunsch nach Nachname", () => {
    const sorted = [...people].sort(compareMembersByName(parseNameSortOrder("last")));
    expect(sorted.map((p) => p.lastName ?? p.name)).toEqual(["Albrecht", "Zander", "Bernd"]);
  });
});
