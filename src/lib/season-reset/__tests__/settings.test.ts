import { describe, expect, it } from "vitest";
import type { SeasonResetSettings } from "@prisma/client";

import { resolveProtectedRoles } from "../settings";

const base = {
  id: "default",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const withRoles: SeasonResetSettings = {
  ...base,
  protectedRoles: ["board", "finance"],
};

const emptyRoles: SeasonResetSettings = {
  ...base,
  protectedRoles: [],
};

const withInvalidEntries: SeasonResetSettings = {
  ...base,
  protectedRoles: ["admin", "bogus", 42],
};

describe("resolveProtectedRoles", () => {
  it("liefert die Defaults, wenn nie konfiguriert wurde", () => {
    expect(resolveProtectedRoles(null)).toEqual(["admin", "owner"]);
    expect(resolveProtectedRoles(undefined)).toEqual(["admin", "owner"]);
  });

  it("erzwingt owner und ergänzt konfigurierte Rollen", () => {
    expect(resolveProtectedRoles(withRoles)).toEqual(["board", "finance", "owner"]);
  });

  it("liefert nur owner bei leerer Konfiguration", () => {
    expect(resolveProtectedRoles(emptyRoles)).toEqual(["owner"]);
  });

  it("filtert ungültige Einträge", () => {
    expect(resolveProtectedRoles(withInvalidEntries)).toEqual(["admin", "owner"]);
  });
});
