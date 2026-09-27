import webpush, { WebPushError } from "web-push";

import { prisma } from "@/lib/prisma";

import type { PreparedNotification } from "./notify";
import { shouldPush } from "./preferences";
import { NOTIFICATION_TYPES } from "./types";

/** Web Push per VAPID (ohne Fremddienst). Schlüssel aus Vault, siehe `.env.example`. */
export function readVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:technik@sommertheater-altrossthal.de";
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

export function isPushConfigured() {
  return readVapidConfig() !== null;
}

const TEST_TYPES = new Set<string>([NOTIFICATION_TYPES.TEST, NOTIFICATION_TYPES.TEST_EMERGENCY]);

/** Inhalte, die über Google/Apple/Mozilla laufen, bleiben knapp: keine Gründe, keine Details. */
const BODY_HIDDEN_TYPES = new Set<string>([
  NOTIFICATION_TYPES.REHEARSAL_ATTENDANCE,
  NOTIFICATION_TYPES.REHEARSAL_EMERGENCY,
  NOTIFICATION_TYPES.PHOTO_CONSENT,
]);

export type PushPayload = {
  title: string;
  body?: string;
  url: string;
  tag: string;
  notificationId: string;
  urgent: boolean;
  badge?: number;
};

export function buildPushPayload(
  prepared: Pick<
    PreparedNotification,
    "id" | "type" | "title" | "body" | "actionUrl" | "groupKey" | "priority"
  >,
  badge?: number,
): PushPayload {
  const body = BODY_HIDDEN_TYPES.has(prepared.type)
    ? "Details in der App"
    : prepared.body?.split("\n")[0]?.slice(0, 180) || undefined;
  return {
    title: prepared.title,
    ...(body ? { body } : {}),
    url: prepared.actionUrl ?? "/mitglieder/benachrichtigungen",
    tag: prepared.groupKey ?? prepared.id,
    notificationId: prepared.id,
    urgent: prepared.priority === "urgent",
    ...(badge !== undefined ? { badge } : {}),
  };
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendToSubscription(subscription: Subscription, payload: PushPayload) {
  const config = readVapidConfig();
  if (!config) return "skipped" as const;
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        vapidDetails: config,
        TTL: 24 * 60 * 60,
        urgency: payload.urgent ? "high" : "normal",
        topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        timeout: 10_000,
      },
    );
    return "sent" as const;
  } catch (error) {
    // Abo abgelaufen oder vom Nutzer entfernt: nicht mehr versuchen.
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => null);
      return "gone" as const;
    }
    console.warn("[push] delivery failed", error);
    return "failed" as const;
  }
}

async function openCount(userId: string) {
  return prisma.notificationRecipient.count({
    where: {
      userId,
      archivedAt: null,
      OR: [{ readAt: null }, { doneAt: null, notification: { kind: "action" } }],
    },
  });
}

/** Stellt eine angelegte Benachrichtigung per Push an alle Geräte der Empfänger zu. */
export async function pushNotification(prepared: PreparedNotification) {
  if (!isPushConfigured()) return;

  const [subscriptions, preferences] = await Promise.all([
    prisma.pushSubscription.findMany({
      where: { userId: { in: prepared.recipientIds } },
      select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
    }),
    prisma.notificationPreference.findMany({
      where: { userId: { in: prepared.recipientIds }, category: prepared.category },
      select: { userId: true, category: true, push: true },
    }),
  ]);
  if (!subscriptions.length) return;

  const preferenceByUser = new Map(preferences.map((entry) => [entry.userId, entry]));
  const byUser = new Map<string, Subscription[]>();
  for (const { userId, ...subscription } of subscriptions) {
    // Testbenachrichtigungen sollen genau das zeigen: ob Push ankommt.
    const isTest = TEST_TYPES.has(prepared.type);
    if (!isTest && !shouldPush(prepared, preferenceByUser.get(userId))) continue;
    byUser.set(userId, [...(byUser.get(userId) ?? []), subscription]);
  }

  const delivered: string[] = [];
  await Promise.all(
    [...byUser].map(async ([userId, devices]) => {
      const payload = buildPushPayload(prepared, await openCount(userId));
      const results = await Promise.all(
        devices.map(async (device) => ({
          device,
          result: await sendToSubscription(device, payload),
        })),
      );
      const sent = results.filter((entry) => entry.result === "sent");
      if (!sent.length) return;
      delivered.push(userId);
      await prisma.pushSubscription.updateMany({
        where: { id: { in: sent.map((entry) => entry.device.id) } },
        data: { lastUsedAt: new Date() },
      });
    }),
  );

  if (delivered.length) {
    await prisma.notificationRecipient.updateMany({
      where: { notificationId: prepared.id, userId: { in: delivered } },
      data: { pushedAt: new Date() },
    });
  }
}

/** Test-Push an die eigenen Geräte (Einstellungen). */
export async function sendTestPush(userId: string) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const payload: PushPayload = {
    title: "Test-Benachrichtigung",
    body: "So kommen Benachrichtigungen auf diesem Gerät an.",
    url: "/mitglieder/benachrichtigungen",
    tag: `test-${userId}`,
    notificationId: "test",
    urgent: false,
  };
  const results = await Promise.all(
    subscriptions.map((entry) => sendToSubscription(entry, payload)),
  );
  return { devices: subscriptions.length, sent: results.filter((r) => r === "sent").length };
}
