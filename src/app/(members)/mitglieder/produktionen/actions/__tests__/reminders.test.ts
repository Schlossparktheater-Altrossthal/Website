import { beforeEach, describe, expect, it, vi } from "vitest";

import { remindMissingPhotoConsentsAction, remindOpenOnboardingsAction } from "../reminders";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  createSender: vi.fn(),
  findOpen: vi.fn(),
  sendPhoto: vi.fn(),
  invite: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAuth: async () => ({ user: { id: "admin-1" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/email/send", () => ({ createConfiguredMailSender: mocks.createSender }));
vi.mock("@/lib/produktionen/returnee-invites", () => ({ inviteFormerMembers: mocks.invite }));
vi.mock("@/lib/produktionen/production-reminders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/produktionen/production-reminders")>()),
  findOpenOnboardingUserIds: mocks.findOpen,
  sendPhotoConsentReminders: mocks.sendPhoto,
}));

const form = () => {
  const data = new FormData();
  data.set("showId", "show-1");
  return data;
};

describe("Erinnerungen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.hasPermission.mockResolvedValue(true);
  });

  it("schickt offenen Onboardings einen neuen Link", async () => {
    const sender = vi.fn();
    mocks.createSender.mockResolvedValue(sender);
    mocks.findOpen.mockResolvedValue(["a", "b"]);
    mocks.invite.mockResolvedValue([
      { userId: "a", name: "A", status: "sent", link: null },
      { userId: "b", name: "B", status: "sent", link: null },
    ]);

    const result = await remindOpenOnboardingsAction(form());

    expect(mocks.invite).toHaveBeenCalledWith({
      showId: "show-1",
      userIds: ["a", "b"],
      createdById: "admin-1",
      sender,
    });
    expect(result).toMatchObject({
      ok: true,
      message: "2 Erinnerungen mit neuem Link verschickt.",
    });
  });

  it("meldet, wenn niemand offen ist", async () => {
    mocks.findOpen.mockResolvedValue([]);

    const result = await remindOpenOnboardingsAction(form());

    expect(result).toEqual({
      ok: true,
      message: "Niemand hat ein offenes Onboarding.",
      outcomes: [],
    });
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it("verlangt für Fotoerlaubnis-Erinnerungen einen Mailversand", async () => {
    mocks.createSender.mockResolvedValue(null);

    const result = await remindMissingPhotoConsentsAction(form());

    expect(result.ok).toBe(false);
    expect(mocks.sendPhoto).not.toHaveBeenCalled();
  });

  it("fasst Fotoerlaubnis-Erinnerungen zusammen", async () => {
    mocks.createSender.mockResolvedValue(vi.fn());
    mocks.sendPhoto.mockResolvedValue({ sent: 3, noEmail: 0, failed: 0 });

    expect(await remindMissingPhotoConsentsAction(form())).toEqual({
      ok: true,
      message: "3 Erinnerungen verschickt.",
    });
  });

  it("verweigert ohne Berechtigung", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect((await remindMissingPhotoConsentsAction(form())).ok).toBe(false);
    expect((await remindOpenOnboardingsAction(form())).ok).toBe(false);
  });
});
