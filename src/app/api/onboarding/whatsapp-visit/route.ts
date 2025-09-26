import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
    const profile = await prisma.memberOnboardingProfile.findUnique({
      where: { userId },
      select: { id: true, redemptionId: true, whatsappLinkVisitedAt: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: true, visitedAt: null });
    }

    if (profile.whatsappLinkVisitedAt) {
      return NextResponse.json({
        ok: true,
        visitedAt: profile.whatsappLinkVisitedAt.toISOString(),
      });
    }

    const updatedProfile = await prisma.memberOnboardingProfile.update({
      where: { userId },
      data: { whatsappLinkVisitedAt: visitedAt },
      select: { whatsappLinkVisitedAt: true, redemptionId: true },
    });

    if (profile.redemptionId) {
      await prisma.memberInviteRedemption
        .update({
          where: { id: profile.redemptionId },
          data: { whatsappLinkVisitedAt: visitedAt },
        })
        .catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      visitedAt: updatedProfile.whatsappLinkVisitedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[onboarding.whatsapp-visit] profile", error);
    return NextResponse.json({ error: "Aktion fehlgeschlagen" }, { status: 500 });
  }
}
