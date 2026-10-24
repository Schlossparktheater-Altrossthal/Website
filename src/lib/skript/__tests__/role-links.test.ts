import { describe, expect, it } from "vitest";

import {
  blockHasRole,
  learnRoleIds,
  resolveGroupMembers,
  roleIdsByUser,
  type GroupRule,
  type LinkRole,
} from "../role-links";

const role = (id: string, name: string, extra: Partial<LinkRole> = {}): LinkRole => ({
  id,
  name,
  aliases: [],
  kind: "person",
  groupMode: null,
  linked: false,
  characterIds: [],
  ...extra,
});

const casting = (
  userId: string,
  characterId: string,
  name: string,
  shortName: string | null = null,
) => ({
  userId,
  characterId,
  name,
  shortName,
});

describe("roleIdsByUser", () => {
  it("nutzt ohne Verknüpfung weiter die Namensgleichheit", () => {
    const roles = [role("r1", "Fogg", { aliases: ["phileas fogg"] })];
    const map = roleIdsByUser(roles, [casting("u1", "c1", "Phileas Fogg")]);
    expect(map.get("u1")).toEqual(["r1"]);
  });

  it("verknüpfte Rollen zählen nur über ihre Stück-Rollen", () => {
    const roles = [role("r1", "FOGG", { linked: true, characterIds: ["c9"] })];
    const map = roleIdsByUser(roles, [
      casting("u1", "c1", "Fogg"),
      casting("u2", "c9", "Phileas Fogg"),
    ]);
    expect(map.get("u1")).toBeUndefined();
    expect(map.get("u2")).toEqual(["r1"]);
  });

  it("verknüpft ohne Stück-Rolle = niemand", () => {
    const roles = [role("r1", "Fogg", { linked: true })];
    expect(roleIdsByUser(roles, [casting("u1", "c1", "Fogg")]).size).toBe(0);
  });

  it("ignorierte Rollen gehören niemandem", () => {
    const roles = [role("r1", "Fogg", { kind: "ignore" })];
    expect(roleIdsByUser(roles, [casting("u1", "c1", "Fogg")]).size).toBe(0);
  });

  it("„Alle“ bekommen Besetzte ohne eigene Sprechrolle direkt", () => {
    const roles = [role("r1", "Fogg"), role("g", "Alle", { kind: "group", groupMode: "cast" })];
    const map = roleIdsByUser(roles, [
      casting("u1", "c1", "Fogg"),
      casting("u2", "c2", "Ensemble"),
    ]);
    expect(map.get("u1")).toEqual(["r1"]);
    expect(map.get("u2")).toEqual(["g"]);
  });

  it("Gruppe mit verknüpfter Stück-Rolle gehört deren Besetzung", () => {
    const roles = [
      role("g", "Chor", { kind: "group", groupMode: "fixed", linked: true, characterIds: ["c2"] }),
    ];
    expect(roleIdsByUser(roles, [casting("u2", "c2", "Chor")]).get("u2")).toEqual(["g"]);
  });
});

describe("resolveGroupMembers", () => {
  const block = { lineageId: "l1", sceneKey: "s1", roleIds: ["g"] };
  const rule = (r: Partial<GroupRule>): GroupRule => ({
    groupRoleId: "g",
    memberRoleId: "a",
    sceneKey: null,
    lineageId: null,
    mode: "include",
    ...r,
  });
  const resolve = (groupMode: LinkRole["groupMode"], rules: GroupRule[] = []) =>
    resolveGroupMembers({
      group: { id: "g", groupMode },
      rules,
      block,
      castRoleIds: ["a", "b", "c"],
      sceneRoleIds: ["a", "b"],
    }).sort();

  it("cast = alle Besetzten, present = alle in der Szene", () => {
    expect(resolve("cast")).toEqual(["a", "b", "c"]);
    expect(resolve("present")).toEqual(["a", "b"]);
  });

  it("fixed = nur die Grundliste", () => {
    expect(resolve("fixed", [rule({ memberRoleId: "c" })])).toEqual(["c"]);
  });

  it("Grund-Ausschluss: „Alle ohne Fogg“", () => {
    expect(resolve("cast", [rule({ memberRoleId: "a", mode: "exclude" })])).toEqual(["b", "c"]);
  });

  it("Szene ersetzt, Absatz ersetzt die Szene", () => {
    const rules = [
      rule({ memberRoleId: "c", sceneKey: "s1" }),
      rule({ memberRoleId: "b", sceneKey: "s1" }),
    ];
    expect(resolve("cast", rules)).toEqual(["b", "c"]);
    expect(resolve("cast", [...rules, rule({ memberRoleId: "a", lineageId: "l1" })])).toEqual([
      "a",
    ]);
    expect(
      resolve("cast", [...rules, rule({ memberRoleId: "b", lineageId: "l1", mode: "exclude" })]),
    ).toEqual(["c"]);
  });

  it("Regeln anderer Szenen und Gruppen zählen nicht", () => {
    expect(
      resolve("present", [
        rule({ memberRoleId: "c", sceneKey: "s2" }),
        rule({ groupRoleId: "x", memberRoleId: "c", lineageId: "l1" }),
      ]),
    ).toEqual(["a", "b"]);
  });
});

describe("blockHasRole / learnRoleIds", () => {
  const block = { roleIds: ["g"], memberRoleIds: ["a"] };
  it("Gruppenpassage gehört Mitgliedern, abschaltbar", () => {
    expect(blockHasRole(block, new Set(["a"]))).toBe(true);
    expect(blockHasRole(block, new Set(["a"]), false)).toBe(false);
  });
  it("gelernt wird unter der Gruppenrolle", () => {
    expect(learnRoleIds(block, new Set(["a"]), true, new Set(["g"]))).toEqual(["g"]);
    expect(learnRoleIds(block, new Set(["a"]), false, new Set(["g"]))).toEqual([]);
    expect(learnRoleIds({ roleIds: ["a"] }, new Set(["a"]), true, new Set())).toEqual(["a"]);
  });
});
