import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/rbac";
import { INBOX_SECTIONS, loadInbox, purgeArchived } from "@/lib/notifications/inbox";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types";
import { readDismissedNoticeKeys } from "@/lib/notice-dismissals";

/** Hinweis „Benachrichtigungen auf diesem Gerät erlauben“ in der Glocke. */
const DEVICE_NOTIFICATIONS_NOTICE_KEY = "device-notifications";

const querySchema = z.object({
  section: z.enum(INBOX_SECTIONS).optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  archived: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ items: [], groups: [], nextCursor: null });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  try {
    if (!parsed.data.cursor) {
      await purgeArchived(userId).catch((error) =>
        console.warn("[notifications] purge failed", error),
      );
    }
    const [inbox, dismissed] = await Promise.all([
      loadInbox(userId, parsed.data),
      parsed.data.cursor
        ? Promise.resolve(new Set<string>())
        : readDismissedNoticeKeys(userId, [DEVICE_NOTIFICATIONS_NOTICE_KEY]),
    ]);
    return NextResponse.json({
      ...inbox,
      hints: { deviceNotificationsDismissed: dismissed.has(DEVICE_NOTIFICATIONS_NOTICE_KEY) },
    });
  } catch (error) {
    console.error("Error fetching notifications", error);
    return NextResponse.json(
      { error: "Benachrichtigungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
