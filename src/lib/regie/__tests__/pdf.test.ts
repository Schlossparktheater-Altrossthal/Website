import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { BINDER_DEFAULT_PARTS, parseBinderParts, sceneRows } from "@/lib/regie/pdf";
import type { DirectionCastRole, DirectionScene } from "@/lib/regie/data";

const role = (id: string, ...users: string[]): DirectionCastRole => ({
  id,
  name: id.toUpperCase(),
  color: null,
  castings: users.map((userId, index) => ({
    userId,
    name: userId,
    type: index === 0 ? "primary" : "alternate",
  })),
});
const scene: DirectionScene = { id: "s1", label: "1.1 Anfang", act: 1, characterIds: ["a", "b"] };

describe("sceneRows", () => {
  const roles = [role("a", "anna", "alex"), role("b", "ben")];

  it("ist probbar, wenn niemand fehlt", () => {
    const [row] = sceneRows([scene], roles, ["2026-10-20"], new Map());
    expect(row.cells[0]).toEqual({ status: "ready", note: null });
    expect(row.cast).toBe("A: anna / alex · B: ben");
  });

  it("nimmt die Zweitbesetzung, wenn die Erstbesetzung fehlt", () => {
    const [row] = sceneRows([scene], roles, ["d"], new Map([["anna:d", "BLOCKED"]]));
    expect(row.cells[0].status).toBe("alternate");
  });

  it("meldet fehlende Rollen ohne Gründe", () => {
    const [row] = sceneRows([scene], roles, ["d"], new Map([["ben:d", "BLOCKED"]]));
    expect(row.cells[0]).toEqual({ status: "missing", note: "B" });
  });

  it("unterscheidet eingeschränkt", () => {
    const [row] = sceneRows([scene], roles, ["d"], new Map([["ben:d", "LIMITED"]]));
    expect(row.cells[0]).toEqual({ status: "limited", note: "B" });
  });
});

describe("parseBinderParts", () => {
  it("hält die feste Reihenfolge und verwirft Unbekanntes", () => {
    expect(parseBinderParts("besetzung,foo,termine,termine")).toEqual(["termine", "besetzung"]);
  });

  it("lässt das Skript nie in die Mappe", () => {
    expect(parseBinderParts("skript,besetzung")).toEqual(["besetzung"]);
  });

  it("nimmt ohne Auswahl die Vorauswahl", () => {
    expect(parseBinderParts(null)).toEqual(BINDER_DEFAULT_PARTS);
    expect(parseBinderParts("foo")).toEqual(BINDER_DEFAULT_PARTS);
  });
});
