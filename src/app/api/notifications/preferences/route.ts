import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/notifications/push";
import { isMailConfigured } from "@/lib/email/send";
import {
  DIGEST_MODES,
  EMAIL_MODES,
  EVENT_REMINDER_LEAD_CODES,
  resolveDigestMode,
  resolveEmailMode,
  resolveReminderLead,
} from "@/lib/notifications/preferences";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types";

/** Eigene Benachrichtigungs-Einstellungen: Push/E-Mail je Bereich, Zusammenfassung, Ruhezeit, Vorlauf. */
export const GET = withRoute({ name: "notifications/preferences.get" }, async ({ userId }) => {
  const [preferences, settings] = await Promise.all([
    prisma.notificationPreference.findMany({
      where: { userId },
      select: { category: true, push: true, emailMode: true },
    }),
    prisma.notificationSettings.findUnique({ where: { userId } }),
  ]);
  const byCategory = new Map(preferences.map((entry) => [entry.category, entry]));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return NextResponse.json({
    pushConfigured: isPushConfigured(),
    mailConfigured: await isMailConfigured(),
    email: user?.email ?? null,
    digest: resolveDigestMode(settings?.digest),
    categories: NOTIFICATION_CATEGORIES.map((category) => ({
      category,
      push: byCategory.get(category)?.push ?? false,
      emailMode: resolveEmailMode(byCategory.get(category)?.emailMode),
    })),
    quietHours:
      settings?.quietStart != null && settings.quietEnd != null
        ? { start: settings.quietStart, end: settings.quietEnd }
        : null,
    reminderLead: resolveReminderLead(settings?.reminderLead),
  });
});

const minutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);
const updateSchema = z.union([
  z.object({ category: z.enum(NOTIFICATION_CATEGORIES), push: z.boolean() }),
  z.object({ quietHours: z.object({ start: minutes, end: minutes }).nullable() }),
  z.object({ reminderLead: z.enum(EVENT_REMINDER_LEAD_CODES) }),
  z.object({ category: z.enum(NOTIFICATION_CATEGORIES), emailMode: z.enum(EMAIL_MODES) }),
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
