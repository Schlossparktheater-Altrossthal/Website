import { requireApiSession, withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { FeedScope } from "@prisma/client";

import {
  buildFeedUrl,
  DEFAULT_FEED_PREFIX,
  generateFeedToken,
  FEED_PREFIXES,
} from "@/lib/calendar/feed";
import { prisma } from "@/lib/prisma";

type FeedRecord = {
  token: string;
  scope: FeedScope;
  includeBlockedDays: boolean;
  name: string | null;
  prefix: string | null;
  lastAccessedAt: Date | null;
};

function toResponse(feed: FeedRecord | null) {
  return NextResponse.json(
    feed
      ? {
          url: buildFeedUrl(feed.token),
          scope: feed.scope,
          includeBlockedDays: feed.includeBlockedDays,
          name: feed.name,
          prefix: feed.prefix ?? DEFAULT_FEED_PREFIX,
          lastAccessedAt: feed.lastAccessedAt?.toISOString() ?? null,
        }
      : null,
  );
}

async function currentUserId() {
  const session = await requireApiSession();
  return session.user?.id ?? null;
}

const unauthorized = () => NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

/** Eigener Kalender-Link (oder `null`, solange keiner erzeugt wurde). */
export const GET = withRoute({ name: "calendar/feed.get" }, async () => {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return toResponse(await prisma.calendarFeed.findUnique({ where: { userId } }));
});

/** Link erzeugen oder ersetzen – ein alter Link ist danach ungültig, Einstellungen bleiben. */
export const POST = withRoute({ name: "calendar/feed.post" }, async () => {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const token = generateFeedToken();
  const feed = await prisma.calendarFeed.upsert({
    where: { userId },
    create: { userId, token },
    update: { token, lastAccessedAt: null },
  });
  return toResponse(feed);
});

const patchSchema = z
  .object({
    includeBlockedDays: z.boolean(),
    scope: z.enum(["MINE", "PRODUCTIONS"]),
    // Leer = ohne Symbol.
    prefix: z.enum(FEED_PREFIXES),
    // Leer = Standardname.
    name: z
      .string()
      .trim()
      .max(60)
      .transform((value) => value || null)
      .nullable(),
  })
  .partial();

export const PATCH = withRoute({ name: "calendar/feed.patch" }, async ({ request }) => {
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
    data: parsed.data,
  });
  return toResponse(feed);
});

/** Link abschalten. */
export const DELETE = withRoute({ name: "calendar/feed.delete" }, async () => {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await prisma.calendarFeed.deleteMany({ where: { userId } });
  return toResponse(null);
});
