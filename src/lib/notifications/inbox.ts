import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

/** Archivierte Einträge werden nach dieser Zeit gelöscht. */
export const ARCHIVE_RETENTION_DAYS = 90;

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

function asCategory(value: string): NotificationCategory {
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

export function countInbox(
  rows: readonly Pick<InboxItem, "kind" | "readAt" | "doneAt" | "category" | "priority">[],
): InboxCounts {
  const byCategory = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, 0])) as Record<
    NotificationCategory,
    number
  >;
  const counts: InboxCounts = { action: 0, new: 0, urgent: 0, byCategory };
  for (const row of rows) {
    const section = itemSection(row);
    if (section === "earlier") continue;
    counts[section] += 1;
    byCategory[row.category] += 1;
    if (row.priority === "urgent") counts.urgent += 1;
  }
  return counts;
}

const recipientInclude = {
  notification: {
    select: {
      id: true,
      type: true,
      category: true,
      kind: true,
      priority: true,
      title: true,
      body: true,
      actionUrl: true,
      groupKey: true,
      eventId: true,
      showId: true,
      actorId: true,
      data: true,
      createdAt: true,
    },
  },
} satisfies Prisma.NotificationRecipientInclude;

type RecipientRow = Prisma.NotificationRecipientGetPayload<{ include: typeof recipientInclude }>;

function toItem(row: RecipientRow): InboxItem {
  const n = row.notification;
  return {
    id: row.id,
    notificationId: n.id,
    type: n.type,
    category: asCategory(n.category),
    kind: n.kind === "action" ? "action" : "info",
    priority: n.priority === "urgent" ? "urgent" : "normal",
    title: n.title,
    body: n.body,
    actionUrl: n.actionUrl,
    groupKey: n.groupKey,
    eventId: n.eventId,
    showId: n.showId,
    actorId: n.actorId,
    data: n.data,
    createdAt: n.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    doneAt: row.doneAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

export type InboxQuery = {
  category?: NotificationCategory;
  section?: InboxSection;
  archived?: boolean;
  /** Empfänger-ID des letzten Eintrags der vorigen Seite. */
  cursor?: string;
  limit?: number;
};

function sectionWhere(section: InboxSection | undefined): Prisma.NotificationRecipientWhereInput {
  switch (section) {
    case "action":
      return { doneAt: null, notification: { kind: "action" } };
    case "new":
      return { readAt: null, notification: { kind: "info" } };
    case "earlier":
      return {
        OR: [
          { readAt: { not: null }, notification: { kind: "info" } },
          { doneAt: { not: null }, notification: { kind: "action" } },
        ],
      };
    default:
      return {};
  }
}

export async function loadInbox(userId: string, query: InboxQuery = {}) {
  const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
  const baseWhere: Prisma.NotificationRecipientWhereInput = {
    userId,
    archivedAt: query.archived ? { not: null } : null,
  };

  const where: Prisma.NotificationRecipientWhereInput = {
    AND: [
      baseWhere,
      sectionWhere(query.section),
      query.category ? { notification: { category: query.category } } : {},
    ],
  };

  const [rows, openRows] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where,
      include: recipientInclude,
      orderBy: [{ notification: { createdAt: "desc" } }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    // Zähler immer über den ganzen offenen Posteingang, unabhängig von Filtern und Seite.
    prisma.notificationRecipient.findMany({
      where: {
        userId,
        archivedAt: null,
        OR: [{ readAt: null }, { doneAt: null, notification: { kind: "action" } }],
      },
      select: {
        readAt: true,
        doneAt: true,
        notification: { select: { kind: true, category: true, priority: true } },
      },
    }),
  ]);

  const page = rows.slice(0, limit).map(toItem);
  const counts = countInbox(
    openRows.map((row) => ({
      readAt: row.readAt?.toISOString() ?? null,
      doneAt: row.doneAt?.toISOString() ?? null,
      kind: row.notification.kind === "action" ? "action" : "info",
      category: asCategory(row.notification.category),
      priority: row.notification.priority === "urgent" ? "urgent" : "normal",
    })),
  );

  return {
    items: page,
    groups: groupInboxItems(page),
    counts,
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}

/** Löscht eigene archivierte Einträge nach Ablauf der Aufbewahrung. */
export async function purgeArchived(userId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.notificationRecipient.deleteMany({
    where: { userId, archivedAt: { lt: cutoff } },
  });
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

export type InboxTarget = {
  /** Empfänger-IDs */
  ids?: string[];
  groupKeys?: string[];
  /** Alle offenen bzw. alle Einträge (optional je Kategorie) */
  all?: boolean;
  category?: NotificationCategory;
};

function stateData(
  action: InboxStateAction,
  now: Date,
): Prisma.NotificationRecipientUpdateManyMutationInput {
  switch (action) {
    case "read":
      return { readAt: now };
    case "unread":
      return { readAt: null };
    case "done":
      return { doneAt: now, readAt: now };
    case "undone":
      return { doneAt: null };
    case "archive":
      return { archivedAt: now, readAt: now };
    case "unarchive":
      return { archivedAt: null };
  }
}

/** Setzt den Status eigener Einträge; nur bisher abweichende Zeilen werden angefasst. */
export async function updateInboxState(
  userId: string,
  action: InboxStateAction,
  target: InboxTarget,
  now = new Date(),
) {
  const ids = target.ids?.filter(Boolean) ?? [];
  const groupKeys = target.groupKeys?.filter(Boolean) ?? [];
  if (!target.all && !ids.length && !groupKeys.length) return 0;

  const selectors: Prisma.NotificationRecipientWhereInput[] = [];
  if (ids.length) selectors.push({ id: { in: ids } });
  if (groupKeys.length) selectors.push({ notification: { groupKey: { in: groupKeys } } });

  const unchanged: Record<InboxStateAction, Prisma.NotificationRecipientWhereInput> = {
    read: { readAt: null },
    unread: { readAt: { not: null } },
    done: { doneAt: null },
    undone: { doneAt: { not: null } },
    archive: { archivedAt: null },
    unarchive: { archivedAt: { not: null } },
  };

  const result = await prisma.notificationRecipient.updateMany({
    where: {
      AND: [
        { userId },
        unchanged[action],
        target.all ? {} : { OR: selectors },
        target.category ? { notification: { category: target.category } } : {},
      ],
    },
    data: stateData(action, now),
  });
  return result.count;
}

/**
 * Markiert Aktions-Einträge bei allen Empfängern als erledigt, z. B. wenn eine Leitung eine
 * Gewerke-Anfrage bearbeitet hat. `dataMatch` filtert auf Felder in `Notification.data`.
 */
export async function resolveActionNotifications(
  filter: {
    type: string;
    groupKey?: string;
    dataMatch?: Record<string, string>;
    now?: Date;
  },
  db: Pick<typeof prisma, "notificationRecipient"> | Prisma.TransactionClient = prisma,
) {
  const dataFilters: Prisma.NotificationWhereInput[] = Object.entries(filter.dataMatch ?? {}).map(
    ([key, value]) => ({ data: { path: [key], equals: value } }),
  );
  const result = await db.notificationRecipient.updateMany({
    where: {
      doneAt: null,
      notification: {
        type: filter.type,
        kind: "action",
        ...(filter.groupKey ? { groupKey: filter.groupKey } : {}),
        ...(dataFilters.length ? { AND: dataFilters } : {}),
      },
    },
    data: { doneAt: filter.now ?? new Date() },
  });
  return result.count;
}
