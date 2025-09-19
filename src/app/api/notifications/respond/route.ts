import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/realtime/triggers";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = respondSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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
            rehearsal: {
              select: {
                id: true,
                title: true,
                start: true,
                location: true,
                registrationDeadline: true,
                createdBy: true,
              },
            },
          },
        },
      },
    });

    if (!recipient || recipient.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rehearsalId = recipient.notification.rehearsalId;
    const rehearsal = recipient.notification.rehearsal;
    if (!rehearsalId || !rehearsal) {
      return NextResponse.json({ error: "Rehearsal not linked" }, { status: 400 });
    }

    const now = new Date();
    const deadline = rehearsal.registrationDeadline;
    if (response === "no" && deadline && now > deadline) {
      return NextResponse.json(
        {
          error: "Die Rückmeldefrist ist bereits abgelaufen. Bitte nutze den Notfall-Button.",
          code: "DEADLINE_PASSED",
        },
        { status: 422 },
      );
    }

    const nextStatus = response === "emergency" ? "emergency" : response;
    const emergencyReason = response === "emergency" ? trimmedReason : null;

    const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });
    const actorDisplayName =
      session.user?.name?.trim() || session.user?.email?.trim() || "Ein Mitglied";
    const formattedStart = formatter.format(rehearsal.start);
    const locationInfo = rehearsal.location ? ` · Ort: ${rehearsal.location}` : "";

    const creatorId = rehearsal.createdBy && rehearsal.createdBy !== userId ? rehearsal.createdBy : null;
    const creatorNotification = creatorId
      ? (() => {
          if (nextStatus === "emergency") {
            const bodyParts = [
              `${actorDisplayName} hat einen Notfall gemeldet und kann am ${formattedStart}${locationInfo} nicht teilnehmen.`,
            ];
            if (emergencyReason) {
              bodyParts.push(`Grund: ${emergencyReason}`);
            }
            return {
              title: `Notfall: ${actorDisplayName} fällt für ${rehearsal.title || "die Probe"} aus`,
              body: bodyParts.join(" "),
              type: "rehearsal-emergency" as const,
              severity: "error" as const,
            };
          }

          return {
            title: `Absage: ${actorDisplayName} kann nicht teilnehmen`,
            body: `${actorDisplayName} hat für die Probe am ${formattedStart}${locationInfo} abgesagt.`,
            type: "rehearsal-attendance" as const,
            severity: "warning" as const,
          };
        })()
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.notificationRecipient.update({
        where: { id: recipientId },
        data: { readAt: new Date() },
      });

      await tx.rehearsalAttendance.upsert({
        where: { rehearsalId_userId: { rehearsalId, userId } },
        update: { status: nextStatus, emergencyReason },
        create: { rehearsalId, userId, status: nextStatus, emergencyReason },
      });

      if (creatorId && creatorNotification) {
        await tx.notification.create({
          data: {
            title: creatorNotification.title,
            body: creatorNotification.body,
            type: creatorNotification.type,
            rehearsalId,
            recipients: {
              create: { userId: creatorId },
            },
          },
        });
      }
    });

    if (creatorId && creatorNotification) {
      await sendNotification({
        targetUserId: creatorId,
        title: creatorNotification.title,
        body: creatorNotification.body,
        type: creatorNotification.severity,
        metadata: { rehearsalId },
      });
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("Error responding to notification", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
