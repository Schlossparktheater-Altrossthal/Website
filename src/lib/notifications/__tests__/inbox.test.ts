import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { countInbox, groupInboxItems, itemSection, type InboxItem } from "../inbox";

let seq = 0;
function item(overrides: Partial<InboxItem> = {}): InboxItem {
  seq += 1;
  return {
    id: `r${seq}`,
    notificationId: `n${seq}`,
    type: "test",
    category: "system",
    kind: "info",
    priority: "normal",
    title: `Eintrag ${seq}`,
    body: null,
    actionUrl: null,
    groupKey: null,
    eventId: null,
    showId: null,
    actorId: null,
    data: null,
    createdAt: new Date(2026, 8, 27, 12, 60 - seq).toISOString(),
    readAt: null,
    doneAt: null,
    archivedAt: null,
    ...overrides,
  };
}

const READ = "2026-09-27T10:00:00.000Z";

describe("itemSection", () => {
  it("ordnet nach Handlungsbedarf, dann gelesen", () => {
    expect(itemSection(item({ kind: "action", readAt: READ }))).toBe("action");
    expect(itemSection(item({ kind: "action", doneAt: READ, readAt: READ }))).toBe("earlier");
    expect(itemSection(item())).toBe("new");
    expect(itemSection(item({ readAt: READ }))).toBe("earlier");
  });
});

describe("groupInboxItems", () => {
  it("bündelt gleiche groupKeys und nimmt den neuesten als Kopf", () => {
    const first = item({ groupKey: "decline:e1", title: "Absage Anna" });
    const single = item();
    const second = item({ groupKey: "decline:e1", title: "Absage Ben", readAt: READ });
    const groups = groupInboxItems([first, single, second]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: "group:decline:e1",
      count: 2,
      unreadCount: 1,
      section: "new",
    });
    expect(groups[0].latest.title).toBe("Absage Anna");
    expect(groups[1].key).toBe(single.id);
  });

  it("hebt das Bündel in den dringendsten Abschnitt", () => {
    const groups = groupInboxItems([
      item({ groupKey: "g", readAt: READ }),
      item({ groupKey: "g", kind: "action", priority: "urgent", readAt: READ }),
    ]);
    expect(groups[0]).toMatchObject({ section: "action", priority: "urgent" });
  });

  it("stellt Dringendes im selben Abschnitt nach oben", () => {
    const normal = item();
    const urgent = item({ priority: "urgent" });
    expect(groupInboxItems([normal, urgent]).map((g) => g.key)).toEqual([urgent.id, normal.id]);
  });
});

describe("countInbox", () => {
  it("zählt nur Offenes, je Kategorie", () => {
    const counts = countInbox([
      item({ kind: "action", category: "gewerke", readAt: READ }),
      item({ category: "proben", priority: "urgent" }),
      item({ category: "proben", readAt: READ }),
      item({ kind: "action", doneAt: READ, readAt: READ }),
    ]);
    expect(counts).toMatchObject({ action: 1, new: 1, urgent: 1 });
    expect(counts.byCategory).toMatchObject({ gewerke: 1, proben: 1, system: 0 });
  });

  it("zählt ein Bündel einmal, im dringendsten Abschnitt", () => {
    const counts = countInbox([
      item({ groupKey: "decline:e1", category: "proben" }),
      item({ groupKey: "decline:e1", category: "proben", kind: "action", priority: "urgent" }),
      item({ groupKey: "decline:e1", category: "proben" }),
    ]);
    expect(counts).toMatchObject({ action: 1, new: 0, urgent: 1 });
    expect(counts.byCategory.proben).toBe(1);
  });
});
