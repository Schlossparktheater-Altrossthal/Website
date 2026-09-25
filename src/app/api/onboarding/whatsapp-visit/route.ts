import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getActiveProductionId } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const requestSchema = z
  .object({
    sessionToken: z.string().min(16).optional(),
  })
  .transform((value) => ({
    sessionToken: value.sessionToken?.trim() ?? undefined,
  }));

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = requestSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { sessionToken } = parsed.data;
  const visitedAt = new Date();

  if (sessionToken) {
    try {
      const redemption = await prisma.memberInviteRedemption.findUnique({
        where: { sessionToken },
        select: { id: true, whatsappLinkVisitedAt: true, userId: true },
      });

      if (!redemption) {
        return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
      }

      if (redemption.whatsappLinkVisitedAt) {
        return NextResponse.json({
          ok: true,
          visitedAt: redemption.whatsappLinkVisitedAt.toISOString(),
        });
      }

      const updated = await prisma.memberInviteRedemption.update({
        where: { id: redemption.id },
        data: { whatsappLinkVisitedAt: visitedAt },
        select: { whatsappLinkVisitedAt: true, userId: true },
      });

      await prisma.productionOnboarding
        .updateMany({
          where: { redemptionId: redemption.id, whatsappLinkVisitedAt: null },
          data: { whatsappLinkVisitedAt: visitedAt },
        })
        .catch(() => null);

      if (updated.userId) {
        await prisma.memberOnboardingProfile
          .update({
            where: { userId: updated.userId },
            data: { whatsappLinkVisitedAt: visitedAt },
          })
          .catch(() => null);
      }

      return NextResponse.json({
        ok: true,
        visitedAt: updated.whatsappLinkVisitedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("[onboarding.whatsapp-visit] redemption", error);
      return NextResponse.json({ error: "Aktion fehlgeschlagen" }, { status: 500 });
    }
  }

  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    // Der Besuch gilt pro Produktion; das Onboarding-Profil hält nur noch den letzten Stand.
    const showId = await getActiveProductionId(userId);
    const existing = showId
      ? await prisma.productionOnboarding.findUnique({
          where: { userId_showId: { userId, showId } },
          select: { id: true, whatsappLinkVisitedAt: true },
        })
      : null;

    if (existing?.whatsappLinkVisitedAt) {
      return NextResponse.json({
        ok: true,
        visitedAt: existing.whatsappLinkVisitedAt.toISOString(),
      });
    }

    if (existing) {
      await prisma.productionOnboarding.update({
        where: { id: existing.id },
        data: { whatsappLinkVisitedAt: visitedAt },
      });
    }

    const profile = await prisma.memberOnboardingProfile.findUnique({
      where: { userId },
      select: { id: true, redemptionId: true, showId: true },
    });

    if (profile && (!showId || profile.showId === showId)) {
      await prisma.memberOnboardingProfile.update({
        where: { userId },
        data: { whatsappLinkVisitedAt: visitedAt },
      });
      if (profile.redemptionId) {
        await prisma.memberInviteRedemption
          .update({
            where: { id: profile.redemptionId },
            data: { whatsappLinkVisitedAt: visitedAt },
          })
          .catch(() => null);
      }
    }

    const recorded =
      Boolean(existing) || Boolean(profile && (!showId || profile.showId === showId));
    return NextResponse.json({ ok: true, visitedAt: recorded ? visitedAt.toISOString() : null });
  } catch (error) {
    console.error("[onboarding.whatsapp-visit] profile", error);
    return NextResponse.json({ error: "Aktion fehlgeschlagen" }, { status: 500 });
  }
}
