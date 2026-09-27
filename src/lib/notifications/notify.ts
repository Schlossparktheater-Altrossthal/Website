import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/realtime/triggers";

import {
  NOTIFICATION_TYPE_META,
  eventActionUrl,
  type NotificationCategory,
  type NotificationKind,
  type NotificationPriority,
  type NotificationSeverity,
  type NotificationType,
} from "./types";

type NotificationDb = Pick<PrismaClient | Prisma.TransactionClient, "notification">;

export type NotifyInput = {
  type: NotificationType;
  recipients: readonly string[];
  title: string;
  body?: string | null;
  /** Ziel beim Anklicken; ohne Angabe bei `eventId` die Terminseite. */
  actionUrl?: string | null;
  eventId?: string | null;
  showId?: string | null;
  /** Auslöser; wird nie selbst benachrichtigt. */
  actorId?: string | null;
  groupKey?: string | null;
  data?: Prisma.InputJsonValue;
  /** Überschreibt die Standardwerte des Typs. */
  category?: NotificationCategory;
  kind?: NotificationKind;
  priority?: NotificationPriority;
  severity?: NotificationSeverity;
  /** Zusatzdaten nur für das Realtime-Event. */
  realtimeMetadata?: Record<string, unknown>;
};

export type PreparedNotification = {
  id: string;
  recipientIds: string[];
  title: string;
  body: string | null;
  actionUrl: string | null;
  eventId: string | null;
  category: NotificationCategory;
  kind: NotificationKind;
  priority: NotificationPriority;
  severity: NotificationSeverity;
  groupKey: string | null;
  realtimeMetadata?: Record<string, unknown>;
};

export function resolveRecipients(recipients: readonly string[], actorId?: string | null) {
  return [...new Set(recipients)].filter((id) => Boolean(id) && id !== actorId);
}

/**
 * Legt die Benachrichtigung an (auch innerhalb einer Transaktion nutzbar). Zustellen danach
 * mit `dispatchNotification`, sobald die Transaktion durch ist.
 */
export async function createNotification(
  db: NotificationDb,
  input: NotifyInput,
): Promise<PreparedNotification | null> {
  const recipientIds = resolveRecipients(input.recipients, input.actorId);
  if (!recipientIds.length) return null;

  const meta = NOTIFICATION_TYPE_META[input.type];
  const category = input.category ?? meta.category;
  const kind = input.kind ?? meta.kind;
  const priority = input.priority ?? meta.priority;
  const actionUrl = input.actionUrl ?? (input.eventId ? eventActionUrl(input.eventId) : null);
  const body = input.body?.trim() ? input.body : null;

  const created = await db.notification.create({
    data: {
      title: input.title,
      body,
      type: input.type,
      category,
      kind,
      priority,
      actionUrl,
      groupKey: input.groupKey ?? null,
      eventId: input.eventId ?? null,
      showId: input.showId ?? null,
      actorId: input.actorId ?? null,
      ...(input.data !== undefined ? { data: input.data } : {}),
      recipients: { create: recipientIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });

  return {
    id: created.id,
    recipientIds,
    title: input.title,
    body,
    actionUrl,
    eventId: input.eventId ?? null,
    category,
    kind,
    priority,
    severity: input.severity ?? meta.severity,
    groupKey: input.groupKey ?? null,
    realtimeMetadata: input.realtimeMetadata,
  };
}

/** Stellt eine angelegte Benachrichtigung zu (Realtime; Push folgt in Phase 5). */
export async function dispatchNotification(prepared: PreparedNotification | null) {
  if (!prepared) return;
  const metadata = {
    notificationId: prepared.id,
    category: prepared.category,
    kind: prepared.kind,
    priority: prepared.priority,
    ...(prepared.groupKey ? { groupKey: prepared.groupKey } : {}),
    ...(prepared.eventId
      ? prepared.category === "proben"
        ? { rehearsalId: prepared.eventId }
        : { eventId: prepared.eventId }
      : {}),
    ...prepared.realtimeMetadata,
  };

  const results = await Promise.allSettled(
    prepared.recipientIds.map((userId) =>
      sendNotification({
        id: prepared.id,
        targetUserId: userId,
        title: prepared.title,
        body: prepared.body ?? undefined,
        type: prepared.severity,
        actionUrl: prepared.actionUrl ?? undefined,
        metadata,
      }),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[notify] realtime delivery failed", result.reason);
    }
  }
}

/** Anlegen und zustellen in einem Schritt – der Normalfall außerhalb von Transaktionen. */
export async function notify(input: NotifyInput) {
  const prepared = await createNotification(prisma, input);
  await dispatchNotification(prepared);
  return prepared;
}
