import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type CleanupRequest =
  | { action: "clear_read" }
  | { action: "delete_ids"; ids: string[] }
  | { action: "clear_older_than"; days: number };

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) return NextResponse.json({ ok: true });

    const body = (await request.json().catch(() => null)) as CleanupRequest | null;
    if (!body || typeof body !== "object" || !("action" in body)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let deleted = 0;

    if (body.action === "clear_read") {
      const res = await prisma.notificationRecipient.deleteMany({
        where: { userId, readAt: { not: null } },
      });
      deleted = res.count;
    } else if (body.action === "delete_ids") {
      const ids = Array.isArray((body as any).ids) ? (body as any).ids.filter((x: unknown) => typeof x === "string") : [];
      if (!ids.length) return NextResponse.json({ ok: true, deleted: 0 });
      const res = await prisma.notificationRecipient.deleteMany({
        where: { userId, id: { in: ids } },
      });
      deleted = res.count;
    } else if (body.action === "clear_older_than") {
      const days = Number((body as any).days);
      if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: "Invalid days" }, { status: 400 });
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const res = await prisma.notificationRecipient.deleteMany({
        where: { userId, notification: { createdAt: { lt: cutoff } } },
      });
      deleted = res.count;
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Optional: cleanup orphan Notification records (no recipients left)
    const orphanIds = await prisma.notification.findMany({
      where: { recipients: { none: {} } },
      select: { id: true },
      take: 1000,
    });
    if (orphanIds.length) {
      await prisma.notification.deleteMany({ where: { id: { in: orphanIds.map((o) => o.id) } } });
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error("[notifications/cleanup] failed", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

