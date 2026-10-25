import { withRoute, type AuthedSession } from "@/lib/api/route";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/notifications/push";
import { isMailConfigured } from "@/lib/email/send";
import {
  ADMIN_TOPIC_DESCRIPTIONS,
  ADMIN_TOPIC_LABELS,
  CATEGORY_DESCRIPTIONS,
  DIGEST_MODES,
  EMAIL_MODES,
  EVENT_REMINDER_LEAD_CODES,
  resolveDigestMode,
  resolveEmailMode,
  resolveReminderLead,
} from "@/lib/notifications/preferences";
import { CATEGORY_LABELS } from "@/lib/notifications/format";
import {
  ADMIN_TOPICS,
  NOTIFICATION_CATEGORIES,
  PREFERENCE_KEYS,
  adminTopicForType,
  type AdminTopic,
} from "@/lib/notifications/types";
import { FINANCE_PERMISSION_KEYS } from "@/lib/finance/constants";
import { INVENTORY_PERMISSION_KEYS, hasPermission } from "@/lib/permissions";

/** Wer ist für welches Verwaltungs-Thema zuständig? Entscheidet, welche Themen erscheinen. */
async function responsibleTopics(session: AuthedSession, userId: string): Promise<AdminTopic[]> {
  const [photos, finance, inventory, departmentLead, received] = await Promise.all([
    hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"),
    hasPermission(session.user, FINANCE_PERMISSION_KEYS.manage),
    hasPermission(session.user, INVENTORY_PERMISSION_KEYS.manage),
    prisma.departmentMembership.count({
      where: { userId, status: "active", role: { in: ["lead", "deputy"] } },
    }),
    // Wer schon Hinweise bekommen hat, soll sie auch abstellen können.
    prisma.notification.findMany({
      where: { category: "verwaltung", recipients: { some: { userId } } },
      distinct: ["type"],
      select: { type: true },
    }),
  ]);
  const topics = new Set<AdminTopic>();
  if (photos) topics.add("fotoerlaubnisse");
  if (finance || departmentLead > 0) topics.add("auslagen");
  if (inventory) topics.add("lager");
  for (const { type } of received) {
    const topic = adminTopicForType(type);
    if (topic) topics.add(topic);
  }
  return ADMIN_TOPICS.filter((topic) => topics.has(topic));
}

/**
 * Eigene Benachrichtigungs-Einstellungen: Push/E-Mail/Aufgaben-Mail je Bereich bzw.
 * Verwaltungs-Thema, Zusammenfassung, Ruhezeit, Vorlauf.
 */
export const GET = withRoute(
  { name: "notifications/preferences.get" },
  async ({ session, userId }) => {
    const [preferences, settings, topics, user] = await Promise.all([
      prisma.notificationPreference.findMany({
        where: { userId },
        select: { category: true, push: true, emailMode: true, actionEmail: true },
      }),
      prisma.notificationSettings.findUnique({ where: { userId } }),
      responsibleTopics(session, userId),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    const byKey = new Map(preferences.map((entry) => [entry.category, entry]));
    const entry = (key: string, label: string, description: string) => ({
      key,
      label,
      description,
      push: byKey.get(key)?.push ?? false,
      emailMode: resolveEmailMode(byKey.get(key)?.emailMode),
      actionEmail: byKey.get(key)?.actionEmail ?? true,
    });
    return NextResponse.json({
      pushConfigured: isPushConfigured(),
      mailConfigured: await isMailConfigured(),
      email: user?.email ?? null,
      digest: resolveDigestMode(settings?.digest),
      categories: NOTIFICATION_CATEGORIES.filter((category) => category !== "verwaltung").map(
        (category) => entry(category, CATEGORY_LABELS[category], CATEGORY_DESCRIPTIONS[category]),
      ),
      adminTopics: topics.map((topic) =>
        entry(`verwaltung:${topic}`, ADMIN_TOPIC_LABELS[topic], ADMIN_TOPIC_DESCRIPTIONS[topic]),
      ),
      quietHours:
        settings?.quietStart != null && settings.quietEnd != null
          ? { start: settings.quietStart, end: settings.quietEnd }
          : null,
      reminderLead: resolveReminderLead(settings?.reminderLead),
    });
  },
);

const minutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);
const preferenceKeySchema = z.string().refine((value) => PREFERENCE_KEYS.includes(value));
const updateSchema = z.union([
  z.object({ category: preferenceKeySchema, push: z.boolean() }),
  z.object({ quietHours: z.object({ start: minutes, end: minutes }).nullable() }),
  z.object({ reminderLead: z.enum(EVENT_REMINDER_LEAD_CODES) }),
  z.object({ category: preferenceKeySchema, emailMode: z.enum(EMAIL_MODES) }),
  z.object({ category: preferenceKeySchema, actionEmail: z.boolean() }),
  z.object({ digest: z.enum(DIGEST_MODES) }),
]);

export const PUT = withRoute(
  { name: "notifications/preferences.put" },
  async ({ request, userId }) => {
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

    if ("emailMode" in parsed.data) {
      const { category, emailMode } = parsed.data;
      await prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category } },
        create: { userId, category, push: false, emailMode },
        update: { emailMode },
      });
    } else if ("actionEmail" in parsed.data) {
      const { category, actionEmail } = parsed.data;
      await prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category } },
        create: { userId, category, push: false, actionEmail },
        update: { actionEmail },
      });
    } else if ("digest" in parsed.data) {
      const { digest } = parsed.data;
      await prisma.notificationSettings.upsert({
        where: { userId },
        create: { userId, digest },
        update: { digest },
      });
    } else if ("push" in parsed.data) {
      const { category, push } = parsed.data;
      await prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category } },
        create: { userId, category, push },
        update: { push },
      });
    } else if ("reminderLead" in parsed.data) {
      const { reminderLead } = parsed.data;
      await prisma.notificationSettings.upsert({
        where: { userId },
        create: { userId, reminderLead },
        update: { reminderLead },
      });
    } else {
      const quiet = parsed.data.quietHours;
      const data = { quietStart: quiet?.start ?? null, quietEnd: quiet?.end ?? null };
      await prisma.notificationSettings.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    }
    return NextResponse.json({ ok: true });
  },
);
