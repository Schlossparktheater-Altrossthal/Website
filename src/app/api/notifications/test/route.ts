import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/realtime/triggers";
import { getUserDisplayName } from "@/lib/names";

const requestSchema = z.object({
  userId: z.string().min(1),
  mode: z.enum(["normal", "emergency"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const allowed = await hasPermission(session.user, "mitglieder.notifications.test");
    if (!allowed) {
      return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    const { userId, mode } = parsed.data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Mitglied wurde nicht gefunden." }, { status: 404 });
    }

    const actorName = session.user?.name?.trim() || session.user?.email?.trim() || "Ein Mitglied";
    const targetDisplayName = getUserDisplayName(
      {
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        name: targetUser.name,
        email: targetUser.email,
      },
      "dieses Mitglied",
    );

    const isEmergency = mode === "emergency";
    const title = isEmergency ? "Test-Notfallbenachrichtigung" : "Testbenachrichtigung";
    const body = isEmergency
      ? `${actorName} hat eine Notfall-Testbenachrichtigung ausgelöst. Bitte behandle sie wie einen echten Alarm, um Abläufe zu prüfen.`
      : `${actorName} hat eine Testbenachrichtigung gesendet. So sehen Benachrichtigungen im Portal aus.`;

    const notification = await prisma.notification.create({
      data: {
        title,
        body,
        type: isEmergency ? "test-emergency" : "test",
        recipients: {
          create: { userId: targetUser.id },
        },
      },
      select: { id: true },
    });

    await sendNotification({
      targetUserId: targetUser.id,
      title,
      body,
      type: isEmergency ? "error" : "info",
      metadata: {
        scope: "test-notification",
        mode,
        notificationId: notification.id,
        targetName: targetDisplayName,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notifications/test] send failed", error);
    return NextResponse.json(
      { error: "Testbenachrichtigung konnte nicht gesendet werden." },
      { status: 500 },
    );
  }
}
