import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/rbac";
import { updateInboxState } from "@/lib/notifications/inbox";

type Payload = {
  ids?: string[];
};

/** Kompatibilität für die bisherige Glocke: ohne IDs wird alles als gelesen markiert. */
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    const payload = (await request.json().catch(() => null)) as Payload | null;
    const ids = Array.isArray(payload?.ids)
      ? payload!.ids.filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        )
      : [];

    await updateInboxState(userId, "read", ids.length ? { ids } : { all: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error marking notifications as read", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
