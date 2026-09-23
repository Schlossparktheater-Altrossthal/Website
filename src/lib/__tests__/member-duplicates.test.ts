import { describe, expect, it } from "vitest";

import { findPossibleDuplicates, type DuplicateCandidateUser } from "../member-duplicates";

const user = (id: string, overrides: Partial<DuplicateCandidateUser>): DuplicateCandidateUser => ({
  id,
  firstName: null,
  lastName: null,
  name: null,
  email: null,
  dateOfBirth: null,
  deactivatedAt: null,
  ...overrides,
});

describe("findPossibleDuplicates", () => {
  it("erkennt gleiche Namen trotz Schreibweise", () => {
    const groups = findPossibleDuplicates([
      user("a", { firstName: "Jörg", lastName: "Müller" }),
      user("b", { firstName: "jorg", lastName: "Muller " }),
      user("c", { firstName: "Jana", lastName: "Müller" }),
    ]);
    expect(groups).toEqual([
      {
        reason: "Gleicher Name",
        users: [expect.objectContaining({ id: "a" }), expect.objectContaining({ id: "b" })],
      },
    ]);
  });

  it("erkennt Nachname + Geburtsdatum und Zweitadressen", () => {
    const dob = new Date("2008-04-01");
    const groups = findPossibleDuplicates([
      user("a", {
        firstName: "Max",
        lastName: "Weiß",
        dateOfBirth: dob,
        email: "max.weiss@gmail.com",
      }),
      user("b", { firstName: "Maximilian", lastName: "Weiss", dateOfBirth: dob }),
      user("c", { firstName: "M", lastName: "X", email: "maxweiss+theater@googlemail.com" }),
    ]);
    expect(groups.map((group) => [group.reason, group.users.map((entry) => entry.id)])).toEqual([
      ["Gleicher Nachname und Geburtsdatum", ["a", "b"]],
      ["Fast gleiche E-Mail-Adresse", ["a", "c"]],
    ]);
  });

  it("meldet dieselbe Gruppe nur einmal", () => {
    const groups = findPossibleDuplicates([
      user("a", { firstName: "Ann", lastName: "B", email: "ann@x.de" }),
      user("b", { firstName: "Ann", lastName: "B", email: "ann@x.de" }),
    ]);
    expect(groups).toHaveLength(1);
  });
});
