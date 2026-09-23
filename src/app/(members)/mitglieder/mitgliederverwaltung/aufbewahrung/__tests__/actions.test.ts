import { beforeEach, describe, expect, it, vi } from "vitest";

import { anonymizeExpiredAccountAction, purgeExpiredDietaryAction } from "../actions";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  collect: vi.fn(),
  purgeDietary: vi.fn(),
  anonymize: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAuth: async () => ({ user: { id: "admin-1" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn() }) }));
vi.mock("@/lib/retention", () => ({
  collectRetentionCandidates: mocks.collect,
  purgeDietaryData: mocks.purgeDietary,
  purgePhotoConsents: vi.fn(),
  anonymizeAccount: mocks.anonymize,
}));

const form = (userId: string) => {
  const data = new FormData();
  data.set("userId", userId);
  return data;
};

describe("Aufbewahrungs-Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.hasPermission.mockResolvedValue(true);
    mocks.collect.mockResolvedValue({
      dietary: [{ id: "a" }, { id: "b" }],
      accounts: [{ id: "alt" }],
      photoConsents: [],
    });
  });

  it("löscht nur serverseitig ermittelte Kandidaten", async () => {
    mocks.purgeDietary.mockResolvedValue(2);

    const result = await purgeExpiredDietaryAction();

    expect(mocks.purgeDietary).toHaveBeenCalledWith(["a", "b"]);
    expect(result).toEqual({
      ok: true,
      message: "Ernährungs- und Allergiedaten von 2 Personen gelöscht.",
    });
  });

  it("anonymisiert kein Konto, dessen Frist noch läuft", async () => {
    const result = await anonymizeExpiredAccountAction(form("aktuell"));

    expect(result).toEqual({
      ok: false,
      error: "Für dieses Konto ist die Aufbewahrungsfrist nicht abgelaufen.",
    });
    expect(mocks.anonymize).not.toHaveBeenCalled();
  });

  it("anonymisiert abgelaufene Konten", async () => {
    expect(await anonymizeExpiredAccountAction(form("alt"))).toEqual({
      ok: true,
      message: "Konto wurde anonymisiert.",
    });
    expect(mocks.anonymize).toHaveBeenCalledWith("alt");
  });

  it("verweigert ohne Berechtigung", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect((await purgeExpiredDietaryAction()).ok).toBe(false);
    expect(mocks.purgeDietary).not.toHaveBeenCalled();
  });
});
