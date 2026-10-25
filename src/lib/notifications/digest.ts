import { getAppBaseUrl } from "@/lib/app-url";
import { DEFAULT_TIME_ZONE, parseDateTimeInTimeZone } from "@/lib/format/date";
import { renderMail, type MailBlock } from "@/lib/email/layout";
import { queueMail } from "@/lib/email/outbox";
import { isMailConfigured } from "@/lib/email/send";
import {
  NOTIFICATION_SETTINGS_PATH,
  unsubscribeHeaders,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { absoluteActionUrl } from "./email";
import { CATEGORY_LABELS } from "./format";
import { DIGEST_HOUR, resolveDigestMode, resolveEmailMode, type DigestMode } from "./preferences";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  preferenceKey,
  type NotificationCategory,
} from "./types";

const logger = createLogger("mail-digest");

/** Ältere ungelesene Hinweise kommen nicht mehr in die Zusammenfassung. */
const MAX_AGE_DAYS = 7;
const MAX_ITEMS_PER_CATEGORY = 8;

/** Migration, mit der E-Mail als Kanal kam – ältere Hinweise gehören nie in eine Zusammenfassung. */
const MAIL_CHANNEL_MIGRATION = "20261020100000_mail_outbox";
let mailChannelStart: Date | null | undefined;

/** Zeitpunkt des Releases (Migration angewendet); `null`, falls nicht ermittelbar. */
async function readMailChannelStart(): Promise<Date | null> {
  if (mailChannelStart !== undefined) return mailChannelStart;
  try {
    const rows = await prisma.$queryRaw<{ finished_at: Date | null }[]>`
      SELECT finished_at FROM "_prisma_migrations"
      WHERE migration_name = ${MAIL_CHANNEL_MIGRATION} AND finished_at IS NOT NULL
      LIMIT 1`;
    mailChannelStart = rows[0]?.finished_at ?? null;
  } catch (error) {
    logger.warn("Release-Zeitpunkt nicht lesbar", { error: String(error) });
    return null;
  }
  return mailChannelStart;
}

/** Untergrenze: höchstens 7 Tage zurück, nie vor dem Release. */
export function digestWindowStart(now: Date, releasedAt: Date | null) {
  const maxAge = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60_000);
  return releasedAt && releasedAt > maxAge ? releasedAt : maxAge;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFAULT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const itemTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: DEFAULT_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Letzter fälliger Zeitpunkt (18 Uhr Berlin; wöchentlich: Montag) vor oder gleich `now`. */
export function lastDigestSlot(mode: Exclude<DigestMode, "off">, now: Date): Date {
  for (let back = 0; back < 8; back += 1) {
    const day = new Date(now.getTime() - back * 24 * 60 * 60_000);
    const parts = Object.fromEntries(
      dayFormatter.formatToParts(day).map((part) => [part.type, part.value]),
    );
    if (mode === "weekly" && parts.weekday !== "Mon") continue;
    const slot = parseDateTimeInTimeZone(
      `${parts.year}-${parts.month}-${parts.day}`,
      `${String(DIGEST_HOUR).padStart(2, "0")}:00`,
      DEFAULT_TIME_ZONE,
    );
    if (slot.getTime() <= now.getTime()) return slot;
  }
  return new Date(now.getTime() - 7 * 24 * 60 * 60_000);
}

export function isDigestDue(mode: DigestMode, lastSentAt: Date | null, now: Date) {
  if (mode === "off") return false;
  const slot = lastDigestSlot(mode, now);
  return !lastSentAt || lastSentAt.getTime() < slot.getTime();
}

type DigestItem = {
  recipientId: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  category: NotificationCategory;
  createdAt: Date;
};

export function buildDigestMail(input: {
  userId: string;
  firstName: string | null;
  mode: Exclude<DigestMode, "off">;
  items: DigestItem[];
}) {
  const blocks: MailBlock[] = [
    {
      type: "paragraph",
      text:
        input.items.length === 1
          ? "seit der letzten Zusammenfassung ist ein Hinweis ungelesen:"
          : `seit der letzten Zusammenfassung sind ${input.items.length} Hinweise ungelesen:`,
    },
  ];
  for (const category of NOTIFICATION_CATEGORIES) {
    const items = input.items.filter((item) => item.category === category);
    if (!items.length) continue;
    blocks.push({ type: "heading", text: CATEGORY_LABELS[category] ?? category });
    blocks.push({
      type: "list",
      items: [
        ...items
          .slice(0, MAX_ITEMS_PER_CATEGORY)
          .map(
            (item) =>
              `${item.title} (${itemTimeFormatter.format(item.createdAt)}) – ${absoluteActionUrl(item.actionUrl)}`,
          ),
        ...(items.length > MAX_ITEMS_PER_CATEGORY
          ? [`… und ${items.length - MAX_ITEMS_PER_CATEGORY} weitere`]
          : []),
      ],
    });
  }
  blocks.push({
    type: "button",
    label: "Alle Benachrichtigungen",
    url: `${getAppBaseUrl()}/mitglieder/benachrichtigungen`,
  });

  return renderMail({
    subject:
      input.items.length === 1
        ? `Zusammenfassung: ${input.items[0]?.title ?? "1 neuer Hinweis"}`
        : `Zusammenfassung: ${input.items.length} neue Hinweise`,
    preheader: input.items
      .slice(0, 3)
      .map((item) => item.title)
      .join(" · "),
    greeting: input.firstName ? `Hallo ${input.firstName},` : "Hallo,",
    blocks,
    footer: `Du bekommst diese Zusammenfassung ${input.mode === "weekly" ? "montags" : "täglich"} um ${DIGEST_HOUR} Uhr, wenn etwas ungelesen ist. Dringendes und Aufgaben kommen sofort.`,
    settingsUrl: `${getAppBaseUrl()}${NOTIFICATION_SETTINGS_PATH}`,
    unsubscribeUrl: unsubscribePageUrl(input.userId),
  });
}

/**
 * Cron: verschickt fällige Zusammenfassungen. Enthalten ist, was ungelesen, nicht archiviert, noch
 * nicht gemailt und höchstens 7 Tage alt ist – nur aus Bereichen auf „Zusammenfassung“.
 */
export async function dispatchEmailDigests(now = new Date()) {
  const summary = { sent: 0, users: 0 };
  if (!(await isMailConfigured())) return summary;

  const since = digestWindowStart(now, await readMailChannelStart());
  const rows = await prisma.notificationRecipient.findMany({
    where: {
      readAt: null,
      archivedAt: null,
      emailedAt: null,
      notification: {
        createdAt: { gte: since },
        kind: "info",
        priority: "normal",
        type: { notIn: [NOTIFICATION_TYPES.TEST, NOTIFICATION_TYPES.TEST_EMERGENCY] },
      },
      user: { email: { not: null }, deactivatedAt: null },
    },
    select: {
      id: true,
      userId: true,
      notification: {
        select: {
          title: true,
          body: true,
          actionUrl: true,
          category: true,
          type: true,
          createdAt: true,
        },
      },
    },
    orderBy: { notification: { createdAt: "asc" } },
  });
  if (!rows.length) return summary;

  const userIds = [...new Set(rows.map((row) => row.userId))];
  const [users, settings, preferences] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true },
    }),
    prisma.notificationSettings.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, digest: true, digestSentAt: true },
    }),
    prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, category: true, emailMode: true },
    }),
  ]);
  const settingsByUser = new Map(settings.map((entry) => [entry.userId, entry]));
  const modeByUserCategory = new Map(
    preferences.map((entry) => [`${entry.userId}:${entry.category}`, entry.emailMode]),
  );

  for (const user of users) {
    const own = settingsByUser.get(user.id);
    const mode = resolveDigestMode(own?.digest);
    if (!user.email || mode === "off" || !isDigestDue(mode, own?.digestSentAt ?? null, now)) {
      continue;
    }
    const items: DigestItem[] = rows
      .filter((row) => row.userId === user.id)
      .filter(
        (row) =>
          resolveEmailMode(
            modeByUserCategory.get(
              `${user.id}:${preferenceKey(row.notification.category, row.notification.type)}`,
            ),
          ) === "digest",
      )
      .filter((row) => !own?.digestSentAt || row.notification.createdAt > own.digestSentAt)
      .map((row) => ({
        recipientId: row.id,
        title: row.notification.title,
        body: row.notification.body,
        actionUrl: row.notification.actionUrl,
        category: row.notification.category as NotificationCategory,
        createdAt: row.notification.createdAt,
      }));
    if (!items.length) continue;

    try {
      const result = await queueMail({
        kind: "digest",
        to: user.email,
        userId: user.id,
        mail: buildDigestMail({ userId: user.id, firstName: user.firstName, mode, items }),
        headers: unsubscribeHeaders(user.id),
      });
      if (result.status === "blocked") continue;
      await prisma.$transaction([
        prisma.notificationRecipient.updateMany({
          where: { id: { in: items.map((item) => item.recipientId) } },
          data: { emailedAt: now },
        }),
        prisma.notificationSettings.upsert({
          where: { userId: user.id },
          create: { userId: user.id, digestSentAt: now },
          update: { digestSentAt: now },
        }),
      ]);
      summary.sent += items.length;
      summary.users += 1;
    } catch (error) {
      logger.warn("Zusammenfassung fehlgeschlagen", { userId: user.id, error: String(error) });
    }
  }
  return summary;
}
