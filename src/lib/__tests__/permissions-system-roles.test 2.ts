import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), transaction: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appRole: { upsert: mocks.upsert },
    $transaction: mocks.transaction,
  },
}));

describe("ensureSystemRoles", () => {
  beforeEach(() => {
    mocks.upsert.mockReset().mockResolvedValue({});
    mocks.transaction.mockReset().mockImplementation(async (operations: unknown) => operations);
  });

  /** Die Funktion merkt sich ihren Lauf im Modulzustand – je Test ein frisch geladenes Modul. */
  async function loadEnsureSystemRoles() {
    vi.resetModules();
    const permissions = await import("../permissions");
    return permissions.ensureSystemRoles;
  }

  it("legt nur die Pflichtrollen Mitglied, Admin und Owner nach", async () => {
    const ensureSystemRoles = await loadEnsureSystemRoles();

    await ensureSystemRoles();

    const created = mocks.upsert.mock.calls.map(([argument]) => argument.where.name);

    // Vorstand, Ensemble, Technik und Finanzen dürfen gelöscht werden und dürfen deshalb
    // nicht wieder angelegt werden.
    expect([...created].sort()).toEqual(["admin", "member", "owner"]);
    expect(created).not.toContain("cast");
    expect(created).not.toContain("tech");
    expect(created).not.toContain("board");
    expect(created).not.toContain("finance");
  });

  it("kennzeichnet Admin und Owner als Systemrollen, Mitglied nicht", async () => {
    const ensureSystemRoles = await loadEnsureSystemRoles();

    await ensureSystemRoles();

    const roles = new Map(
      mocks.upsert.mock.calls.map(([argument]) => [argument.where.name, argument]),
    );

    expect(roles.get("admin")?.create).toMatchObject({ systemRole: "admin", isSystem: true });
    expect(roles.get("owner")?.create).toMatchObject({ systemRole: "owner", isSystem: true });
    expect(roles.get("member")?.create).toMatchObject({ systemRole: "member", isSystem: false });
  });
});
