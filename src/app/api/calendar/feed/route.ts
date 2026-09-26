import { NextResponse } from "next/server";
import { z } from "zod";

import { buildFeedUrl, generateFeedToken } from "@/lib/calendar/feed";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type FeedRecord = { token: string; includeBlockedDays: boolean; lastAccessedAt: Date | null };

function toResponse(feed: FeedRecord | null) {
  return NextResponse.json(
    feed
      ? {
          url: buildFeedUrl(feed.token),
          includeBlockedDays: feed.includeBlockedDays,
          lastAccessedAt: feed.lastAccessedAt?.toISOString() ?? null,
        }
      : null,
  );
}

async function currentUserId() {
  const session = await requireAuth();
  return session.user?.id ?? null;
}

const unauthorized = () => NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

/** Eigener Kalender-Link (oder `null`, solange keiner erzeugt wurde). */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return toResponse(await prisma.calendarFeed.findUnique({ where: { userId } }));
}

/** Link erzeugen oder ersetzen – ein alter Link ist danach ungültig, Einstellungen bleiben. */
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const token = generateFeedToken();
  const feed = await prisma.calendarFeed.upsert({
    where: { userId },
    create: { userId, token },
    update: { token, lastAccessedAt: null },
  });
  return toResponse(feed);
}

const patchSchema = z.object({ includeBlockedDays: z.boolean() });

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }
  const existing = await prisma.calendarFeed.findUnique({ where: { userId } });
  if (!existing) {
    return NextResponse.json({ error: "Noch kein Kalender-Link vorhanden" }, { status: 404 });
  }
  const feed = await prisma.calendarFeed.update({
    where: { userId },
    data: { includeBlockedDays: parsed.data.includeBlockedDays },
  });
  return toResponse(feed);
}

/** Link abschalten. */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await prisma.calendarFeed.deleteMany({ where: { userId } });
  return toResponse(null);
}
