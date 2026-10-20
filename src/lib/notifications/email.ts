import { getAppBaseUrl } from "@/lib/app-url";
import { renderMail } from "@/lib/email/layout";
import { queueMail } from "@/lib/email/outbox";
import { isMailConfigured } from "@/lib/email/send";
import {
  NOTIFICATION_SETTINGS_PATH,
  unsubscribeHeaders,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import { prisma } from "@/lib/prisma";

import { CATEGORY_LABELS } from "./format";
import type { PreparedNotification } from "./notify";
import { resolveEmailMode, shouldEmailInstantly } from "./preferences";
import { NOTIFICATION_TYPES, type NotificationCategory } from "./types";

const TEST_TYPES = new Set<string>([NOTIFICATION_TYPES.TEST, NOTIFICATION_TYPES.TEST_EMERGENCY]);

export function absoluteActionUrl(actionUrl: string | null) {
  const path = actionUrl ?? "/mitglieder/benachrichtigungen";
  return /^https?:\/\//.test(path) ? path : `${getAppBaseUrl()}${path}`;
}

export function buildNotificationMail(input: {
  userId: string;
  firstName: string | null;
  title: string;
  body: string | null;
  actionUrl: string | null;
  category: NotificationCategory;
  urgent: boolean;
  action: boolean;
}) {
  const label = CATEGORY_LABELS[input.category] ?? input.category;
  return renderMail({
    subject: input.urgent ? `Dringend: ${input.title}` : input.title,
    preheader: input.body?.split("\n")[0]?.slice(0, 120),
    greeting: input.firstName ? `Hallo ${input.firstName},` : "Hallo,",
    blocks: [
      { type: "paragraph", text: input.title },
      ...(input.body ? [{ type: "paragraph" as const, text: input.body }] : []),
      {
        type: "button",
        label: input.action ? "Jetzt erledigen" : "Im Mitgliederbereich öffnen",
        url: absoluteActionUrl(input.actionUrl),
      },
    ],
    footer: input.urgent
      ? `Dringende Hinweise („${label}“) kommen immer per Mail.`
      : input.action
        ? `Aufgaben („${label}“) kommen immer per Mail.`
        : `Du bekommst Hinweise aus „${label}“ sofort per Mail.`,
    settingsUrl: `${getAppBaseUrl()}${NOTIFICATION_SETTINGS_PATH}`,
    unsubscribeUrl: unsubscribePageUrl(input.userId),
  });
}

/**
 * Stellt eine Benachrichtigung sofort per Mail zu, wo die Regeln es verlangen (Dringendes,
 * Aufgaben, Bereich auf „Sofort“). Alles andere sammelt die Zusammenfassung (`./digest.ts`).
 */
export async function emailNotification(
  prepared: PreparedNotification,
  options: { forceInstant?: boolean } = {},
) {
  if (TEST_TYPES.has(prepared.type)) return;
  if (!(await isMailConfigured())) return;

  const [users, preferences] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: prepared.recipientIds }, email: { not: null }, deactivatedAt: null },
      select: { id: true, email: true, firstName: true },
    }),
    prisma.notificationPreference.findMany({
      where: { userId: { in: prepared.recipientIds }, category: prepared.category },
      select: { userId: true, emailMode: true },
    }),
  ]);
  const modeByUser = new Map(preferences.map((entry) => [entry.userId, entry.emailMode]));

  const results = await Promise.all(
    users.map(async (user) => {
      const mode = resolveEmailMode(modeByUser.get(user.id));
      if (!user.email || !shouldEmailInstantly(prepared, mode, options.forceInstant)) return null;
      const mail = buildNotificationMail({
        userId: user.id,
        firstName: user.firstName,
        title: prepared.title,
        body: prepared.body,
        actionUrl: prepared.actionUrl,
        category: prepared.category,
        urgent: prepared.priority === "urgent",
        action: prepared.kind === "action",
      });
      const result = await queueMail({
        kind: "notification",
        to: user.email,
        userId: user.id,
        mail,
        headers: unsubscribeHeaders(user.id),
      });
      return result.status === "blocked" ? null : user.id;
    }),
  );
  const mailed = results.filter((id): id is string => id !== null);

  if (mailed.length) {
    await prisma.notificationRecipient.updateMany({
      where: { notificationId: prepared.id, userId: { in: mailed } },
      data: { emailedAt: new Date() },
    });
  }
}
