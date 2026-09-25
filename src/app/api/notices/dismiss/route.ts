import { NextResponse } from "next/server";
import { z } from "zod";

import { noticeKeySchema, saveNoticeDismissal } from "@/lib/notice-dismissals";
import { requireAuth } from "@/lib/rbac";

const bodySchema = z.object({ key: noticeKeySchema });

export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiger Hinweis" }, { status: 400 });
  }

  try {
    await saveNoticeDismissal(userId, parsed.data.key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notices.dismiss]", error);
    return NextResponse.json(
      { error: "Hinweis konnte nicht ausgeblendet werden" },
      { status: 500 },
    );
  }
}
