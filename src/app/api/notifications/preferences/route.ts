import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/notifications/push";
import { EVENT_REMINDER_LEAD_CODES, resolveReminderLead } from "@/lib/notifications/preferences";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types";
import { requireAuth } from "@/lib/rbac";

/** Eigene Benachrichtigungs-Einstellungen: Push je Bereich, Ruhezeit und Erinnerungs-Vorlauf. */
export async function GET() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const [preferences, settings] = await Promise.all([
    prisma.notificationPreference.findMany({
      where: { userId },
      select: { category: true, push: true },
    }),
    prisma.notificationSettings.findUnique({ where: { userId } }),
  ]);
  const byCategory = new Map(preferences.map((entry) => [entry.category, entry.push]));
  return NextResponse.json({
    pushConfigured: isPushConfigured(),
    categories: NOTIFICATION_CATEGORIES.map((category) => ({
      category,
      push: byCategory.get(category) ?? false,
    })),
    quietHours:
      settings?.quietStart != null && settings.quietEnd != null
        ? { start: settings.quietStart, end: settings.quietEnd }
        : null,
    reminderLead: resolveReminderLead(settings?.reminderLead),
  });
}

const minutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);
const updateSchema = z.union([
  z.object({ category: z.enum(NOTIFICATION_CATEGORIES), push: z.boolean() }),
  z.object({ quietHours: z.object({ start: minutes, end: minutes }).nullable() }),
  z.object({ reminderLead: z.enum(EVENT_REMINDER_LEAD_CODES) }),
]);

export async function PUT(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  if ("category" in parsed.data) {
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
}
