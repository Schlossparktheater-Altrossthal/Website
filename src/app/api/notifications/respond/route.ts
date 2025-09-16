import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type SessionUser = { id?: string | null };

const respondSchema = z.object({
  recipientId: z.string().min(1),
  response: z.enum(["yes", "no"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as SessionUser | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = respondSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { recipientId, response } = parsed.data;

    const recipient = await prisma.notificationRecipient.findUnique({
      where: { id: recipientId },
      include: { notification: true },
    });

    if (!recipient || recipient.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rehearsalId = recipient.notification.rehearsalId;
    if (!rehearsalId) {
      return NextResponse.json({ error: "Rehearsal not linked" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.notificationRecipient.update({
        where: { id: recipientId },
        data: { readAt: new Date() },
      }),
      prisma.rehearsalAttendance.upsert({
        where: { rehearsalId_userId: { rehearsalId, userId } },
        update: { status: response },
        create: { rehearsalId, userId, status: response },
      }),
    ]);

    return NextResponse.json({ ok: true, status: response });
  } catch (error) {
    console.error("Error responding to notification", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
