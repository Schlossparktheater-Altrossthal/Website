import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  resolveActiveInvite: vi.fn(),
  ensureUser: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate } },
}));
vi.mock("@/lib/authentik/config", () => ({ isAuthentikProvisioningEnabled: () => true }));
vi.mock("@/lib/authentik/client", () => ({ sendAuthentikPasswordEmail: mocks.sendMail }));
vi.mock("@/lib/authentik/sync", () => ({
  memberIdentitySelect: { id: true, email: true },
  toMemberIdentity: (member: { id: string; email: string }) => ({
    userId: member.id,
    email: member.email,
    name: null,
  }),
  ensureAuthentikUserForMember: mocks.ensureUser,
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  recordPasswordEmailAttempt: () => ({ allowed: true }),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/onboarding/returnee", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/onboarding/returnee")>();
  return { ...original, resolveActiveInvite: mocks.resolveActiveInvite };
});

import { POST } from "../route";

const request = (body: unknown) =>
  new Request("http://localhost/api/auth/password-email", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("Passwort vergessen für Rückkehrer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureUser.mockResolvedValue({ user: { pk: 1 } });
  });

  it("schickt deaktivierten Mitgliedern ohne Einladung keine Mail", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "a@example.org",
      deactivatedAt: new Date(),
    });

    const response = await POST(request({ email: "a@example.org" }));

    expect(response.status).toBe(200);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.resolveActiveInvite).not.toHaveBeenCalled();
  });

  it("schickt deaktivierten Rückkehrern mit gültigem Einladungslink die Mail", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "a@example.org",
      deactivatedAt: new Date(),
    });
    mocks.resolveActiveInvite.mockResolvedValue({ id: "invite-1", showId: "show-1" });

    await POST(request({ email: "a@example.org", onboardingToken: "token-abc" }));

    expect(mocks.resolveActiveInvite).toHaveBeenCalledWith("token-abc");
    expect(mocks.sendMail).toHaveBeenCalled();
  });

  it("ignoriert ungültige Einladungslinks", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "a@example.org",
      deactivatedAt: new Date(),
    });
    mocks.resolveActiveInvite.mockResolvedValue(null);

    await POST(request({ email: "a@example.org", onboardingToken: "alt" }));

    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("schickt aktiven Mitgliedern die Mail wie bisher", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-2",
      email: "b@example.org",
      deactivatedAt: null,
    });

    await POST(request({ email: "b@example.org" }));

    expect(mocks.sendMail).toHaveBeenCalled();
  });
});
