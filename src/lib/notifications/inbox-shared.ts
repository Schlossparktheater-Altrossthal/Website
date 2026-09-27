import type { Prisma } from "@prisma/client";

import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationKind,
  type NotificationPriority,
} from "./types";

/**
 * Posteingang der Glocke: Abschnitte, Bündel und Zähler.
 *
 * - `action`: braucht eine Reaktion und ist noch nicht erledigt
 * - `new`: ungelesener Hinweis
 * - `earlier`: gelesen bzw. erledigt
 */
export const INBOX_SECTIONS = ["action", "new", "earlier"] as const;
export type InboxSection = (typeof INBOX_SECTIONS)[number];

export type InboxItem = {
  /** ID des Empfänger-Eintrags; damit arbeiten alle Status-Endpunkte. */
  id: string;
  notificationId: string;
  type: string | null;
  category: NotificationCategory;
  kind: NotificationKind;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  actionUrl: string | null;
  groupKey: string | null;
  eventId: string | null;
  showId: string | null;
  actorId: string | null;
  data: Prisma.JsonValue | null;
  createdAt: string;
  readAt: string | null;
  doneAt: string | null;
  archivedAt: string | null;
};

export type InboxGroup = {
  /** `groupKey` oder bei Einzelstücken die Empfänger-ID. */
  key: string;
  section: InboxSection;
  category: NotificationCategory;
  priority: NotificationPriority;
  count: number;
  unreadCount: number;
  /** Neuester Eintrag, bestimmt Titel und Link des Bündels. */
  latest: InboxItem;
  items: InboxItem[];
};

export type InboxCounts = {
  action: number;
  new: number;
  urgent: number;
  /** Offene (action + new) Einträge je Kategorie. */
  byCategory: Record<NotificationCategory, number>;
};

export function asCategory(value: string): NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value)
    ? (value as NotificationCategory)
    : "system";
}

export function itemSection(item: Pick<InboxItem, "kind" | "readAt" | "doneAt">): InboxSection {
  if (item.kind === "action" && !item.doneAt) return "action";
  if (!item.readAt) return "new";
  return "earlier";
}

const SECTION_RANK: Record<InboxSection, number> = { action: 0, new: 1, earlier: 2 };

/**
 * Fasst Einträge mit gleichem `groupKey` zusammen. Erwartet neueste zuerst; das Bündel landet
 * im dringendsten Abschnitt seiner Einträge.
 */
export function groupInboxItems(items: readonly InboxItem[]): InboxGroup[] {
  const groups = new Map<string, InboxGroup>();
  for (const item of items) {
    const key = item.groupKey ? `group:${item.groupKey}` : item.id;
    const section = itemSection(item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        section,
        category: item.category,
        priority: item.priority,
        count: 1,
        unreadCount: item.readAt ? 0 : 1,
        latest: item,
        items: [item],
      });
      continue;
    }
    existing.items.push(item);
    existing.count += 1;
    if (!item.readAt) existing.unreadCount += 1;
    if (SECTION_RANK[section] < SECTION_RANK[existing.section]) existing.section = section;
    if (item.priority === "urgent" && itemSection(item) !== "earlier") existing.priority = "urgent";
  }
  // Dringendes nach oben, sonst chronologisch (Map behält die Reihenfolge der neuesten Einträge).
  return [...groups.values()].sort((a, b) => {
    if (a.section === b.section && a.section !== "earlier") {
      if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
    }
    return 0;
  });
}

type CountRow = Pick<InboxItem, "kind" | "readAt" | "doneAt" | "category" | "priority"> & {
  groupKey?: string | null;
};

/**
 * Offene Einträge zählen – ein Bündel zählt einmal, im dringendsten Abschnitt seiner Einträge,
 * damit Badge und Liste übereinstimmen.
 */
export function countInbox(rows: readonly CountRow[]): InboxCounts {
  const byCategory = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, 0])) as Record<
    NotificationCategory,
    number
  >;
  const counts: InboxCounts = { action: 0, new: 0, urgent: 0, byCategory };
  const groups = new Map<string, { section: InboxSection; row: CountRow; urgent: boolean }>();
  rows.forEach((row, index) => {
    const section = itemSection(row);
    if (section === "earlier") return;
    const key = row.groupKey ? `group:${row.groupKey}` : `row:${index}`;
    const urgent = row.priority === "urgent";
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { section, row, urgent });
      return;
    }
    if (SECTION_RANK[section] < SECTION_RANK[existing.section]) existing.section = section;
    existing.urgent ||= urgent;
  });
  for (const { section, row, urgent } of groups.values()) {
    counts[section as "action" | "new"] += 1;
    byCategory[row.category] += 1;
    if (urgent) counts.urgent += 1;
  }
  return counts;
}

export const INBOX_STATE_ACTIONS = [
  "read",
  "unread",
  "done",
  "undone",
  "archive",
  "unarchive",
] as const;
export type InboxStateAction = (typeof INBOX_STATE_ACTIONS)[number];
