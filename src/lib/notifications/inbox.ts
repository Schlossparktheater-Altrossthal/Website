import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  asCategory,
  countInbox,
  groupInboxItems,
  type InboxItem,
  type InboxSection,
  type InboxStateAction,
} from "./inbox-shared";
import type { NotificationCategory } from "./types";

export * from "./inbox-shared";

/** Archivierte Einträge werden nach dieser Zeit gelöscht. */
export const ARCHIVE_RETENTION_DAYS = 90;

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
  /** Volltext in Titel und Text */
  q?: string;
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
      query.q?.trim()
        ? {
            notification: {
              OR: [
                { title: { contains: query.q.trim(), mode: "insensitive" } },
                { body: { contains: query.q.trim(), mode: "insensitive" } },
              ],
            },
          }
        : {},
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
        notification: { select: { kind: true, category: true, priority: true, groupKey: true } },
      },
    }),
  ]);

  const page = rows.slice(0, limit).map(toItem);
  const counts = countInbox(
    openRows.map((row) => ({
      readAt: row.readAt?.toISOString() ?? null,
      doneAt: row.doneAt?.toISOString() ?? null,
      groupKey: row.notification.groupKey,
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
