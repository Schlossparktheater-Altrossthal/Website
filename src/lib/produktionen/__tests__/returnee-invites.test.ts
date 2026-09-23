import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  showFindUniqueOrThrow: vi.fn(),
  userFindMany: vi.fn(),
  inviteCreate: vi.fn((args: { data: Record<string, unknown> }) => ({ op: "invite", args })),
  membershipUpsert: vi.fn((args: unknown) => ({ op: "membership", args })),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    show: { findUniqueOrThrow: mocks.showFindUniqueOrThrow },
    user: { findMany: mocks.userFindMany },
    memberInvite: { create: mocks.inviteCreate },
    productionMembership: { upsert: mocks.membershipUpsert },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/app-url", () => ({ getAppBaseUrl: () => "https://mitglieder.example.org" }));

import { hashInviteToken } from "@/lib/member-invites";

import { buildReturneeInviteMail, inviteFormerMembers } from "../returnee-invites";

const now = new Date("2026-09-23T10:00:00Z");

function user(id: string, email: string | null, roles: string[] = []) {
  return {
    id,
    firstName: id,
    lastName: null,
    name: null,
    email,
    productionMemberships: [{ roles }],
  };
}

describe("buildReturneeInviteMail", () => {
  it("erklärt Link, Vorausfüllen und neue Fotoerlaubnis", () => {
    const mail = buildReturneeInviteMail({
      to: "anna@example.org",
      name: "Anna",
      showTitle: "Momo",
      link: "https://x/onboarding/t/update",
      expiresAt: new Date("2026-10-23T10:00:00Z"),
    });

    expect(mail.to).toBe("anna@example.org");
    expect(mail.subject).toBe("Bist du bei „Momo“ wieder dabei?");
    expect(mail.text).toContain("https://x/onboarding/t/update");
    expect(mail.text).toContain("Fotoerlaubnis");
    expect(mail.text).toContain("23. Oktober 2026");
  });
});

describe("inviteFormerMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showFindUniqueOrThrow.mockResolvedValue({ id: "show-2027", title: "Momo", year: 2027 });
    mocks.transaction.mockResolvedValue([]);
  });

  it("legt persönliche, einmal nutzbare Einladungen an und verschickt Mails", async () => {
    mocks.userFindMany.mockResolvedValue([user("anna", "anna@example.org", ["tech", "admin"])]);
    const sender = vi.fn().mockResolvedValue(undefined);

    const outcomes = await inviteFormerMembers({
      showId: "show-2027",
      userIds: ["anna", "anna"],
      createdById: "admin-1",
      sender,
      now,
    });

    expect(outcomes).toEqual([{ userId: "anna", name: "anna", status: "sent", link: null }]);
    const inviteData = mocks.inviteCreate.mock.calls[0][0].data;
    expect(inviteData).toMatchObject({
      label: "Rückkehr: anna",
      maxUses: 1,
      roles: ["member", "tech"],
      showId: "show-2027",
      createdById: "admin-1",
      expiresAt: new Date("2026-10-23T10:00:00Z"),
    });
    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: { showId_userId: { showId: "show-2027", userId: "anna" } },
      update: { status: "invited", leftAt: null },
      create: { showId: "show-2027", userId: "anna", status: "invited" },
    });

    // Der Link in der Mail passt zum gespeicherten Hash.
    const link: string = sender.mock.calls[0][0].text.match(/https:\/\/\S+/)[0];
    const token = decodeURIComponent(link.split("/onboarding/")[1].replace("/update", ""));
    expect(link.startsWith("https://mitglieder.example.org/onboarding/")).toBe(true);
    expect(hashInviteToken(token)).toBe(inviteData.tokenHash);
  });

  it("gibt Links zurück, wenn keine Mail möglich ist", async () => {
    mocks.userFindMany.mockResolvedValue([
      user("ohne-mail", null),
      user("ohne-smtp", "b@example.org"),
    ]);

    const outcomes = await inviteFormerMembers({
      showId: "show-2027",
      userIds: ["ohne-mail", "ohne-smtp"],
      createdById: "admin-1",
      sender: null,
      now,
    });

    expect(outcomes.map((outcome) => outcome.status)).toEqual(["no-email", "link-only"]);
    expect(outcomes.every((outcome) => outcome.link?.endsWith("/update"))).toBe(true);
  });

  it("meldet fehlgeschlagene Mails mit Link", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.userFindMany.mockResolvedValue([user("anna", "anna@example.org")]);

    const outcomes = await inviteFormerMembers({
      showId: "show-2027",
      userIds: ["anna"],
      createdById: "admin-1",
      sender: vi.fn().mockRejectedValue(new Error("SMTP down")),
      now,
    });

    expect(outcomes[0].status).toBe("failed");
    expect(outcomes[0].link).toBeTruthy();
  });
});
