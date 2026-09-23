import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redemptionFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    memberInviteRedemption: { findUnique: mocks.redemptionFindUnique },
    user: { findUnique: mocks.userFindUnique },
  },
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  recordOnboardingEmailCheck: mocks.rateLimit,
}));

import { POST } from "../route";

const sessionToken = "s".repeat(32);
const request = (body: unknown) =>
  new Request("http://localhost/api/onboarding/email-check", {
    method: "POST",
    body: JSON.stringify(body),
  });

const openRedemption = {
  completedAt: null,
  invite: { expiresAt: null, maxUses: null, usageCount: 0, isDisabled: false },
};

describe("Onboarding: E-Mail-Prüfung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.redemptionFindUnique.mockResolvedValue(openRedemption);
  });

  it("meldet bekannte Adressen (unabhängig von Groß-/Kleinschreibung)", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });

    const response = await POST(request({ sessionToken, email: " Anna@Example.org " }));

    expect(await response.json()).toEqual({ known: true });
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { email: "anna@example.org" },
      select: { id: true },
    });
  });

  it("meldet unbekannte Adressen", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const response = await POST(request({ sessionToken, email: "neu@example.org" }));

    expect(await response.json()).toEqual({ known: false });
  });

  it("verlangt eine offene Einladungssitzung", async () => {
    mocks.redemptionFindUnique.mockResolvedValue({ ...openRedemption, completedAt: new Date() });

    const response = await POST(request({ sessionToken, email: "a@example.org" }));

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("lehnt deaktivierte Einladungen ab", async () => {
    mocks.redemptionFindUnique.mockResolvedValue({
      ...openRedemption,
      invite: { ...openRedemption.invite, isDisabled: true },
    });

    expect((await POST(request({ sessionToken, email: "a@example.org" }))).status).toBe(403);
  });

  it("ist rate-limitiert", async () => {
    mocks.rateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 60 });

    const response = await POST(request({ sessionToken, email: "a@example.org" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.redemptionFindUnique).not.toHaveBeenCalled();
  });

  it("prüft Eingaben", async () => {
    expect((await POST(request({ sessionToken: "kurz", email: "x" }))).status).toBe(400);
  });
});
