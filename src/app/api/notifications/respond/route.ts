import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notifyPlannersOfDecline } from "@/lib/calendar/decline-notifications";

type SessionUser = { id?: string | null; name?: string | null; email?: string | null };

const respondSchema = z.object({
  recipientId: z.string().min(1),
  response: z.enum(["yes", "no", "emergency"]),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as SessionUser | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = respondSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    const { recipientId, response, reason } = parsed.data;

    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    if (response === "emergency" && !trimmedReason) {
      return NextResponse.json(
        { error: "Bitte gib einen Grund für die Notfall-Absage an.", code: "MISSING_REASON" },
        { status: 400 },
      );
    }

    const recipient = await prisma.notificationRecipient.findUnique({
      where: { id: recipientId },
      include: {
        notification: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                start: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!recipient || recipient.userId !== userId) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const rehearsalId = recipient.notification.eventId;
    const rehearsal = recipient.notification.event;
    if (!rehearsalId || !rehearsal) {
      return NextResponse.json({ error: "Rehearsal not linked" }, { status: 400 });
    }

    const nextStatus = response === "emergency" ? "emergency" : response;
    const emergencyReason = response === "emergency" ? trimmedReason : null;

    await prisma.$transaction(async (tx) => {
      await tx.notificationRecipient.update({
        where: { id: recipientId },
        data: { readAt: new Date() },
      });

      const respondedAt = new Date();
      await tx.eventParticipant.upsert({
        where: { eventId_userId: { eventId: rehearsalId, userId } },
        update: { response: nextStatus, responseNote: emergencyReason, respondedAt },
        create: {
          eventId: rehearsalId,
          userId,
          invited: false,
          response: nextStatus,
          responseNote: emergencyReason,
          respondedAt,
        },
      });
    });

    if (nextStatus !== "yes") {
      await notifyPlannersOfDecline({
        eventId: rehearsalId,
        userId,
        reason: emergencyReason,
      }).catch((error) =>
        console.error("[notifications/respond] Planung nicht benachrichtigt", error),
      );
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("Error responding to notification", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
