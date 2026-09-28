import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  create: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/realtime/triggers", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("../push", () => ({ pushNotification: mocks.push }));
vi.mock("@/lib/prisma", () => ({ prisma: { notification: { create: mocks.create } } }));

import { createNotification, dispatchNotification, notify } from "../notify";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_META, isNotificationType } from "../types";

describe("notify", () => {
  beforeEach(() => {
    mocks.create.mockReset().mockResolvedValue({ id: "n1" });
    mocks.sendNotification.mockReset().mockResolvedValue(undefined);
    mocks.push.mockReset().mockResolvedValue(undefined);
  });

  it("legt Empfänger ohne Auslöser und Duplikate an und übernimmt Standardwerte", async () => {
    const prepared = await createNotification({ notification: { create: mocks.create } } as never, {
      type: NOTIFICATION_TYPES.DEPARTMENT_REQUEST,
      recipients: ["a", "b", "a", "actor"],
      actorId: "actor",
      title: "Anfrage",
    });

    const data = mocks.create.mock.calls[0][0].data;
    expect(data.recipients.create).toEqual([{ userId: "a" }, { userId: "b" }]);
    expect(data).toMatchObject({ category: "gewerke", kind: "action", priority: "normal" });
    expect(data.body).toBeNull();
    expect(prepared?.recipientIds).toEqual(["a", "b"]);
  });

  it("legt ohne Empfänger nichts an", async () => {
    const result = await notify({
      type: NOTIFICATION_TYPES.TEST,
      recipients: ["actor"],
      actorId: "actor",
      title: "x",
    });
    expect(result).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("leitet den Link aus dem Termin ab und stellt pro Empfänger zu", async () => {
    await notify({
      type: NOTIFICATION_TYPES.REHEARSAL_EMERGENCY,
      recipients: ["a", "b"],
      title: "Absage",
      eventId: "e1",
      groupKey: "decline:e1",
    });

    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      actionUrl: "/mitglieder/termine/e1",
      priority: "urgent",
      groupKey: "decline:e1",
    });
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    expect(mocks.sendNotification.mock.calls[0][0]).toMatchObject({
      id: "n1",
      targetUserId: "a",
      type: "error",
      actionUrl: "/mitglieder/termine/e1",
      metadata: { rehearsalId: "e1", category: "proben", priority: "urgent" },
    });
  });

  it("bricht bei fehlgeschlagener Zustellung nicht ab", async () => {
    mocks.sendNotification.mockRejectedValueOnce(new Error("offline"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      dispatchNotification({
        id: "n1",
        type: "test",
        recipientIds: ["a", "b"],
        title: "t",
        body: null,
        actionUrl: null,
        eventId: null,
        category: "system",
        kind: "info",
        priority: "normal",
        severity: "info",
        groupKey: null,
      }),
    ).resolves.toBeUndefined();
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe("Typen-Registry", () => {
  it("kennt jeden Typ", () => {
    for (const type of Object.values(NOTIFICATION_TYPES)) {
      expect(isNotificationType(type)).toBe(true);
      expect(NOTIFICATION_TYPE_META[type]).toBeDefined();
    }
    expect(isNotificationType("unbekannt")).toBe(false);
  });
});

describe("Zentraler Versand", () => {
  it("legt Benachrichtigungen nur über lib/notifications an", () => {
    const root = path.resolve(__dirname, "../../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== "__tests__" && entry !== "node_modules") walk(full);
        } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          if (full.includes(`${path.sep}lib${path.sep}notifications${path.sep}`)) continue;
          if (/\.notification\.(create|createMany)\(/.test(readFileSync(full, "utf8"))) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
