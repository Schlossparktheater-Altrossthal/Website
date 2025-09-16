import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type SessionUser = { id?: string | null };

type Payload = {
  ids?: string[];
};

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as SessionUser | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    const payload = (await request.json().catch(() => null)) as Payload | null;
    const ids = Array.isArray(payload?.ids)
      ? payload!.ids.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

    const where: { userId: string; id?: { in: string[] } } = { userId };
    if (ids.length) {
      where.id = { in: ids };
    }

    await prisma.notificationRecipient.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error marking notifications as read", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
