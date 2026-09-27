import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/rbac";
import { INBOX_STATE_ACTIONS, updateInboxState } from "@/lib/notifications/inbox";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types";

const bodySchema = z
  .object({
    action: z.enum(INBOX_STATE_ACTIONS),
    ids: z.array(z.string().min(1)).max(500).optional(),
    groupKeys: z.array(z.string().min(1)).max(100).optional(),
    all: z.boolean().optional(),
    category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  })
  .refine((body) => body.all || body.ids?.length || body.groupKeys?.length, {
    message: "Ziel fehlt",
  });

/** Status eigener Benachrichtigungen setzen: gelesen, erledigt, archiviert (und zurück). */
export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  try {
    const { action, ...target } = parsed.data;
    const updated = await updateInboxState(userId, action, target);
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("[notifications/state] failed", error);
    return NextResponse.json({ error: "Status konnte nicht gespeichert werden." }, { status: 500 });
  }
}
