import { NextResponse } from "next/server";

import { isPushConfigured, sendTestPush } from "@/lib/notifications/push";
import { requireAuth } from "@/lib/rbac";

/** Test-Push an alle eigenen Geräte. */
export async function POST() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push ist auf diesem Server nicht eingerichtet." },
      { status: 503 },
    );
  }
  return NextResponse.json(await sendTestPush(userId));
}
