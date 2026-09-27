import { beforeEach, describe, expect, it } from "vitest";

import { GET as getInbox } from "@/app/api/notifications/route";
import { POST as postState } from "@/app/api/notifications/state/route";
import { resolveActionNotifications } from "@/lib/notifications/inbox";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";

import { createTestUser, jsonRequest, resetItState, signIn } from "./harness";

type InboxBody = {
  groups: { key: string; section: string; count: number }[];
  items: { id: string; groupKey: string | null }[];
  counts: { action: number; new: number; urgent: number; byCategory: Record<string, number> };
  nextCursor: string | null;
};

async function inbox(query = ""): Promise<InboxBody> {
  const response = await getInbox(jsonRequest(`/api/notifications${query}`, "GET"));
  expect(response.status).toBe(200);
  return response.json();
}

// Plan docs/benachrichtigungen-plan.md, Phase 2.
describe("Benachrichtigungen: Posteingang", () => {
  beforeEach(resetItState);

  it("Migration hat Altbestand eingeordnet", async () => {
    const uncategorized = await prisma.notification.count({
      where: { type: { in: ["rehearsal", "department-request"] }, category: "system" },
    });
    expect(uncategorized).toBe(0);
  });

  it("gruppiert, zählt, blättert und setzt Status", async () => {
    const planner = await createTestUser();
    const key = `decline:it-${planner.id}`;
    for (const name of ["Anna", "Ben", "Cleo"]) {
      await notify({
        type: NOTIFICATION_TYPES.REHEARSAL_ATTENDANCE,
        recipients: [planner.id],
        title: `Absage ${name}`,
        groupKey: key,
      });
    }
    await notify({
      type: NOTIFICATION_TYPES.DEPARTMENT_REQUEST,
      recipients: [planner.id],
      title: "Anfrage",
      data: { departmentId: "dep-it", requesterId: "req-it" },
    });
    await signIn(planner.id);

    let body = await inbox();
    expect(body.counts).toMatchObject({ action: 1, new: 1 });
    expect(body.counts.byCategory).toMatchObject({ proben: 1, gewerke: 1 });
    expect(body.groups).toHaveLength(2);
    expect(body.groups.find((g) => g.key === `group:${key}`)?.count).toBe(3);
    expect((await inbox("?q=cleo")).items).toHaveLength(1);

    const firstPage = await inbox("?limit=2");
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toBeTruthy();
    const secondPage = await inbox(`?limit=2&cursor=${firstPage.nextCursor}`);
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.nextCursor).toBeNull();

    expect((await inbox("?section=action")).items).toHaveLength(1);
    expect((await inbox("?category=proben")).items).toHaveLength(3);
    expect((await getInbox(jsonRequest("/api/notifications?section=bogus", "GET"))).status).toBe(
      400,
    );

    // Bündel als gelesen → nur noch die Anfrage offen
    let response = await postState(
      jsonRequest("/api/notifications/state", "POST", { action: "read", groupKeys: [key] }),
    );
    expect(await response.json()).toMatchObject({ updated: 3 });
    body = await inbox();
    expect(body.counts).toMatchObject({ action: 1, new: 0 });

    // Lesen erledigt keine Aktion
    await postState(jsonRequest("/api/notifications/state", "POST", { action: "read", all: true }));
    expect((await inbox()).counts.action).toBe(1);

    // Bearbeitung durch jemand anderen erledigt die Anfrage
    await resolveActionNotifications({
      type: NOTIFICATION_TYPES.DEPARTMENT_REQUEST,
      dataMatch: { departmentId: "dep-it", requesterId: "req-it" },
    });
    expect((await inbox()).counts.action).toBe(0);

    // Archivieren blendet aus, Archiv-Ansicht zeigt es
    response = await postState(
      jsonRequest("/api/notifications/state", "POST", { action: "archive", groupKeys: [key] }),
    );
    expect(await response.json()).toMatchObject({ updated: 3 });
    expect((await inbox()).items).toHaveLength(1);
    expect((await inbox("?archived=1")).items).toHaveLength(3);
  });

  it("ändert keine fremden Einträge und verlangt ein Ziel", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const prepared = await notify({
      type: NOTIFICATION_TYPES.TEST,
      recipients: [owner.id],
      title: "Privat",
    });
    const recipient = await prisma.notificationRecipient.findFirstOrThrow({
      where: { notificationId: prepared!.id },
    });

    await signIn(other.id);
    const response = await postState(
      jsonRequest("/api/notifications/state", "POST", { action: "archive", ids: [recipient.id] }),
    );
    expect(await response.json()).toMatchObject({ updated: 0 });
    const empty = await postState(
      jsonRequest("/api/notifications/state", "POST", { action: "read" }),
    );
    expect(empty.status).toBe(400);
  });

  it("löscht archivierte Einträge nach 90 Tagen", async () => {
    const user = await createTestUser();
    const prepared = await notify({
      type: NOTIFICATION_TYPES.TEST,
      recipients: [user.id],
      title: "Alt",
    });
    await prisma.notificationRecipient.updateMany({
      where: { notificationId: prepared!.id },
      data: { archivedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) },
    });
    await signIn(user.id);
    await inbox();
    expect(await prisma.notificationRecipient.count({ where: { userId: user.id } })).toBe(0);
  });
});
