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

  it("sortiert nach Rolle, Personen ohne Rolle nach Vorname dahinter", () => {
    const members = [
      { id: "a", firstName: "Anna" },
      { id: "z", firstName: "Zoe" },
      { id: "b", firstName: "Bernd" },
      { id: "c", firstName: "Clara" },
    ];
    const rank: Record<string, number> = { z: 0, c: 1 };
    const sorted = [...members].sort(compareMembersByName("role", (m) => rank[m.id] ?? Infinity));
    expect(sorted.map((m) => m.firstName)).toEqual(["Zoe", "Clara", "Anna", "Bernd"]);
  });
});
