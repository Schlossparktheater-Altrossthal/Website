import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOnboardingWhatsAppLink } from "@/lib/onboarding-settings";
import { prisma } from "@/lib/prisma";
import { getAvailableOnboardings } from "@/lib/onboarding/dashboard-service";
import { requireAuth } from "@/lib/rbac";

const payloadSchema = z.object({
  showId: z.string().min(1, "Bitte wähle eine Produktion."),
});

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ungültige Daten.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const show = await prisma.show.findUnique({
    where: { id: parsed.data.showId },
    select: {
      id: true,
      title: true,
      year: true,
      meta: true,
    },
  });

  if (!show) {
    return NextResponse.json({ error: "Produktion wurde nicht gefunden." }, { status: 404 });
  }

  try {
    const profile = await prisma.memberOnboardingProfile.upsert({
      where: { userId },
      update: {
        showId: show.id,
        whatsappLinkVisitedAt: null,
      },
      create: {
        userId,
        showId: show.id,
        focus: "acting",
      },
      select: {
        whatsappLinkVisitedAt: true,
      },
    });

    const availableOnboardings = await getAvailableOnboardings();
    const onboardingSummary = availableOnboardings.find((entry) => entry.id === show.id) ?? null;

    const whatsappLink = getOnboardingWhatsAppLink(show.meta);

    return NextResponse.json({
      onboarding: {
        show: {
          id: show.id,
          title: show.title ?? null,
          year: show.year ?? null,
          periodLabel: onboardingSummary?.periodLabel ?? null,
          status: onboardingSummary?.status ?? "draft",
        },
        whatsappLink,
        whatsappLinkVisitedAt: profile.whatsappLinkVisitedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[Profile][Onboarding][Show] update failed", error);
    return NextResponse.json(
      { error: "Onboarding konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}
