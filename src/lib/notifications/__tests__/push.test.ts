import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class WebPushError extends Error {
    constructor(public statusCode: number) {
      super(`status ${statusCode}`);
    }
  }
  return {
    WebPushError,
    send: vi.fn(),
    subscriptions: vi.fn(),
    preferences: vi.fn(),
    deleteSub: vi.fn(),
    updateSubs: vi.fn(),
    updateRecipients: vi.fn(),
    count: vi.fn(),
  };
});

vi.mock("web-push", () => ({
  default: { sendNotification: mocks.send },
  WebPushError: mocks.WebPushError,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany: mocks.subscriptions,
      delete: mocks.deleteSub,
      updateMany: mocks.updateSubs,
    },
    notificationPreference: { findMany: mocks.preferences },
    notificationRecipient: { updateMany: mocks.updateRecipients, count: mocks.count },
  },
}));

import type { PreparedNotification } from "../notify";
import { shouldPush } from "../preferences";
import { buildPushPayload, pushNotification } from "../push";

const prepared: PreparedNotification = {
  id: "n1",
  type: "rehearsal-emergency",
  recipientIds: ["a", "b"],
  title: "Kurzfristige Absage: Ben – Probe Sa",
  body: "Grund: krank",
  actionUrl: "/mitglieder/proben/e1",
  eventId: "e1",
  category: "proben",
  kind: "action",
  priority: "urgent",
  severity: "error",
  groupKey: "decline:e1",
};

describe("shouldPush", () => {
  it("schickt Dringendes immer, sonst nach Wahl bzw. nur Aufgaben", () => {
    const info = { category: "gewerke", kind: "info", priority: "normal" } as const;
    expect(shouldPush({ ...info, priority: "urgent" }, { category: "gewerke", push: false })).toBe(
      true,
    );
    expect(shouldPush(info, undefined)).toBe(false);
    expect(shouldPush({ ...info, kind: "action" }, undefined)).toBe(true);
    expect(shouldPush(info, { category: "gewerke", push: true })).toBe(true);
  });
});

describe("buildPushPayload", () => {
  it("verrät keine Absagegründe und bündelt per tag", () => {
    const payload = buildPushPayload(prepared, 3);
    expect(payload).toMatchObject({
      body: "Details in der App",
      tag: "decline:e1",
      url: "/mitglieder/proben/e1",
      urgent: true,
      badge: 3,
    });
  });
});

describe("pushNotification", () => {
  beforeEach(() => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    for (const mock of Object.values(mocks))
      if (typeof mock === "function" && "mockReset" in mock) mock.mockReset();
    mocks.count.mockResolvedValue(2);
    mocks.preferences.mockResolvedValue([]);
    mocks.updateSubs.mockResolvedValue({ count: 1 });
    mocks.updateRecipients.mockResolvedValue({ count: 1 });
    mocks.deleteSub.mockResolvedValue({});
  });

  it("stellt zu, entfernt abgelaufene Abos und merkt sich den Versand", async () => {
    mocks.subscriptions.mockResolvedValue([
      { id: "s1", userId: "a", endpoint: "https://push/1", p256dh: "k", auth: "x" },
      { id: "s2", userId: "b", endpoint: "https://push/2", p256dh: "k", auth: "x" },
    ]);
    mocks.send.mockImplementation(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint.endsWith("/2")) throw new mocks.WebPushError(410);
    });

    await pushNotification(prepared);

    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.deleteSub).toHaveBeenCalledWith({ where: { id: "s2" } });
    expect(mocks.updateRecipients).toHaveBeenCalledWith({
      where: { notificationId: "n1", userId: { in: ["a"] } },
      data: { pushedAt: expect.any(Date) },
    });
  });

  it("respektiert abgewählte Kategorien bei normalen Hinweisen", async () => {
    mocks.subscriptions.mockResolvedValue([
      { id: "s1", userId: "a", endpoint: "https://push/1", p256dh: "k", auth: "x" },
    ]);
    mocks.preferences.mockResolvedValue([{ userId: "a", category: "proben", push: false }]);
    await pushNotification({ ...prepared, priority: "normal", kind: "info" });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("pusht Testbenachrichtigungen unabhängig von der Einstellung", async () => {
    mocks.subscriptions.mockResolvedValue([
      { id: "s1", userId: "a", endpoint: "https://push/1", p256dh: "k", auth: "x" },
    ]);
    mocks.send.mockResolvedValue({});
    await pushNotification({ ...prepared, type: "test", priority: "normal", kind: "info" });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("tut ohne VAPID-Schlüssel nichts", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    await pushNotification(prepared);
    expect(mocks.subscriptions).not.toHaveBeenCalled();
  });
});
