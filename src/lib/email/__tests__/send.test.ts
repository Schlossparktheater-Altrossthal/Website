import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), queueMail: vi.fn() }));

vi.mock("@/lib/server-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server-settings")>()),
  loadResolvedServerSettings: mocks.settings,
}));
vi.mock("../outbox", () => ({ queueMail: mocks.queueMail }));

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("MAIL_HOST", "");
    mocks.queueMail.mockResolvedValue({ id: "m1", status: "sent" });
  });

  it("liefert mit MAIL_DISABLED keinen Versender, obwohl SMTP konfiguriert ist", async () => {
    vi.stubEnv("MAIL_DISABLED", "true");
    mocks.settings.mockResolvedValue(baseSettings);
    expect(await createConfiguredMailSender()).toBeNull();
    expect(mocks.queueMail).not.toHaveBeenCalled();
  });

  it("liefert ohne SMTP-Server keinen Versender", async () => {
    mocks.settings.mockResolvedValue({ ...baseSettings, mailHost: null });
    expect(await createConfiguredMailSender()).toBeNull();
  });

  it("nimmt den SMTP-Server aus der Umgebung, auch wenn die DB leer ist", async () => {
    vi.stubEnv("MAIL_HOST", "smtp.secret.example");
    mocks.settings.mockResolvedValue({ ...baseSettings, mailHost: null });
    expect(await createConfiguredMailSender()).not.toBeNull();
  });

  it("reiht die Mail mit Text- und HTML-Fassung in die Outbox ein", async () => {
    mocks.settings.mockResolvedValue(baseSettings);
    const send = await createConfiguredMailSender();

    await send?.({ to: "a@example.org", subject: "Hallo", text: "Erster\n\nZweiter <b>" });

    const input = mocks.queueMail.mock.calls[0][0];
    expect(input).toMatchObject({ kind: "system", to: "a@example.org" });
    expect(input.mail.subject).toBe("Hallo");
    expect(input.mail.text).toBe("Erster\n\nZweiter <b>");
    expect(input.mail.html).toContain("Zweiter &lt;b&gt;");
  });

  it("wirft nur, wenn die Mail endgültig gescheitert ist", async () => {
    mocks.settings.mockResolvedValue(baseSettings);
    const send = await createConfiguredMailSender();
    mocks.queueMail.mockResolvedValueOnce({ id: "m1", status: "pending", error: "timeout" });
    await expect(send?.({ to: "a@example.org", subject: "s", text: "t" })).resolves.toBeUndefined();
    mocks.queueMail.mockResolvedValueOnce({ id: "m2", status: "failed", error: "kaputt" });
    await expect(send?.({ to: "a@example.org", subject: "s", text: "t" })).rejects.toThrow(
      "kaputt",
    );
  });
});
