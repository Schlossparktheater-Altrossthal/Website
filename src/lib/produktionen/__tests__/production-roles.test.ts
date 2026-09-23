import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  computeEffectiveRoles,
  sanitizeProductionRoles,
  syncProductionRoles,
  type RoleSyncClient,
} from "../production-roles";

describe("computeEffectiveRoles", () => {
  it("übernimmt Ensemble/Technik nur aus aktuellen Produktionen", () => {
    expect(computeEffectiveRoles(["member", "cast", "tech"], [])).toEqual(["member"]);
    expect(computeEffectiveRoles(["member"], [["tech"]])).toEqual(["member", "tech"]);
  });

  it("behält produktionsunabhängige Rollen unverändert", () => {
    expect(computeEffectiveRoles(["member", "board", "finance"], [])).toEqual([
      "member",
      "board",
      "finance",
    ]);
    expect(computeEffectiveRoles(["owner"], [])).toEqual(["owner"]);
    expect(computeEffectiveRoles(["board", "cast"], [])).toEqual(["board"]);
  });

  it("vergibt „Mitglied“, wenn sonst keine Rolle bleibt", () => {
    expect(computeEffectiveRoles(["cast"], [])).toEqual(["member"]);
  });

  it("vereinigt Rollen mehrerer Produktionen", () => {
    expect(computeEffectiveRoles(["member"], [["cast"], ["tech"]])).toEqual([
      "member",
      "cast",
      "tech",
    ]);
  });
});

describe("sanitizeProductionRoles", () => {
  it("lässt nur Ensemble und Technik zu", () => {
    expect(sanitizeProductionRoles(["tech", "admin", "cast", "x"])).toEqual(["cast", "tech"]);
  });
});

describe("syncProductionRoles", () => {
  const client = {
    user: { findMany: vi.fn(), update: vi.fn() },
    userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
  } satisfies RoleSyncClient;

  beforeEach(() => vi.clearAllMocks());

  it("schreibt geänderte Rollen und lässt unveränderte in Ruhe", async () => {
    client.user.findMany.mockResolvedValue([
      {
        id: "neu-in-technik",
        role: "member",
        roles: [{ role: "member" }],
        productionMemberships: [{ roles: ["tech"] }],
      },
      {
        id: "unveraendert",
        role: "member",
        roles: [{ role: "member" }],
        productionMemberships: [],
      },
    ]);

    const changed = await syncProductionRoles(["neu-in-technik", "unveraendert"], client);

    expect(changed).toEqual(["neu-in-technik"]);
    expect(client.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "neu-in-technik", role: "member" },
        { userId: "neu-in-technik", role: "tech" },
      ],
    });
    expect(client.user.update).toHaveBeenCalledWith({
      where: { id: "neu-in-technik" },
      data: { role: "tech" },
    });
  });

  it("fragt ohne Nutzer nicht die Datenbank", async () => {
    expect(await syncProductionRoles([], client)).toEqual([]);
    expect(client.user.findMany).not.toHaveBeenCalled();
  });
});
