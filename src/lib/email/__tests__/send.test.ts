import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), sendMail: vi.fn() }));

vi.mock("@/lib/server-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server-settings")>()),
  loadResolvedServerSettings: mocks.settings,
}));
vi.mock("../transporter", () => ({
  createTransporterFromSettings: () => ({ sendMail: mocks.sendMail }),
}));

import { createConfiguredMailSender } from "../send";

const baseSettings = {
  id: "default",
  mailHost: "mail.example.org",
  mailPort: 587,
  mailSecure: false,
  mailUsername: "theater@example.org",
  mailPassword: "x",
  mailFromAddress: "theater@example.org",
  mailFromName: "Sommertheater",
  mailReplyTo: null,
  updatedAt: null,
};

describe("createConfiguredMailSender", () => {
  beforeEach(() => vi.clearAllMocks());

  it("liefert ohne SMTP-Server keinen Versender", async () => {
    mocks.settings.mockResolvedValue({ ...baseSettings, mailHost: null });
    expect(await createConfiguredMailSender()).toBeNull();
  });

  it("verschickt mit Absender aus den Server-Einstellungen", async () => {
    mocks.settings.mockResolvedValue(baseSettings);
    const send = await createConfiguredMailSender();

    await send?.({ to: "a@example.org", subject: "Hallo", text: "Text" });

    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "Sommertheater <theater@example.org>",
      replyTo: undefined,
      to: "a@example.org",
      subject: "Hallo",
      text: "Text",
    });
  });
});
