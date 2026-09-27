import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { INBOX_SECTIONS, loadInbox, purgeArchived } from "@/lib/notifications/inbox";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types";

// Lokaler Typ synchron zu prisma.schema (AttendanceStatus: yes | no | emergency | maybe)
type AttendanceStatus = "yes" | "no" | "emergency" | "maybe";

/** Altes Format für die bisherige Glocke; entfällt mit dem neuen UI (Phase 3). */
type LegacyNotification = {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt: string | null;
  type?: string | null;
  rehearsal: { id: string; title: string; start: string } | null;
  attendanceStatus: AttendanceStatus | null;
};

const querySchema = z.object({
  section: z.enum(INBOX_SECTIONS).optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  archived: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ notifications: [], items: [], groups: [], nextCursor: null });
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
    const inbox = await loadInbox(userId, parsed.data);

    const eventIds = [
      ...new Set(inbox.items.flatMap((item) => (item.eventId ? [item.eventId] : []))),
    ];
    const [events, attendance] = eventIds.length
      ? await Promise.all([
          prisma.calendarEvent.findMany({
            where: { id: { in: eventIds } },
            select: { id: true, title: true, start: true },
          }),
          prisma.eventParticipant.findMany({
            where: { userId, eventId: { in: eventIds }, response: { not: null } },
            select: { eventId: true, response: true },
          }),
        ])
      : [[], []];
    const eventMap = new Map(events.map((event) => [event.id, event]));
    const attendanceMap = new Map<string, AttendanceStatus>(
      attendance.flatMap((entry) => (entry.response ? [[entry.eventId, entry.response]] : [])),
    );

    const notifications: LegacyNotification[] = inbox.items.map((item) => {
      const event = item.eventId ? eventMap.get(item.eventId) : undefined;
      return {
        id: item.id,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt,
        readAt: item.readAt,
        type: item.type,
        rehearsal: event
          ? { id: event.id, title: event.title, start: event.start.toISOString() }
          : null,
        attendanceStatus: item.eventId ? (attendanceMap.get(item.eventId) ?? null) : null,
      };
    });

    return NextResponse.json({ ...inbox, notifications });
  } catch (error) {
    console.error("Error fetching notifications", error);
    return NextResponse.json(
      { error: "Benachrichtigungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
