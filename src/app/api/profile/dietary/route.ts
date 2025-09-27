import { NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_STRICTNESS_FOR_NONE,
  dietaryPreferenceSchema,
  resolveDietaryStrictnessLabel,
  resolveDietaryStyleLabel,
  type DietaryStrictnessOption,
} from "@/data/dietary-preferences";
import { prisma } from "@/lib/prisma";
import {
  broadcastOnboardingDashboardForUser,
  broadcastOnboardingDashboardSnapshot,
} from "@/lib/onboarding/dashboard-events";
import { requireAuth } from "@/lib/rbac";

function parseRequestBody(body: unknown) {
  const result = dietaryPreferenceSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Ungültige Eingaben.";
    throw new Error(message);
  }
  return result.data;
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseRequestBody(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ungültige Eingaben.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const style = parsed.style;
  const strictnessBaseline = style === "none" || style === "omnivore";
  const strictness: DietaryStrictnessOption = strictnessBaseline
    ? DEFAULT_STRICTNESS_FOR_NONE
    : parsed.strictness;
  const customLabel = parsed.customLabel ?? null;

  const { label: styleLabel, custom } = resolveDietaryStyleLabel(
    style,
    customLabel,
  );
  const strictnessLabel = resolveDietaryStrictnessLabel(style, strictness);

  try {
    const profile = await prisma.memberOnboardingProfile.upsert({
      where: { userId },
      update: {
        dietaryPreference: styleLabel,
        dietaryPreferenceStrictness: strictnessLabel,
      },
      create: {
        userId,
        focus: "acting",
        dietaryPreference: styleLabel,
        dietaryPreferenceStrictness: strictnessLabel,
      },
      select: {
        dietaryPreference: true,
        dietaryPreferenceStrictness: true,
        showId: true,
      },
    });

    try {
      if (profile.showId) {
        await broadcastOnboardingDashboardSnapshot(profile.showId);
      } else {
        await broadcastOnboardingDashboardForUser(userId);
      }
    } catch (error) {
      console.error("[Profile][Dietary] realtime update failed", error);
    }

    return NextResponse.json({
      preference: {
        style,
        strictness,
        customLabel: custom,
        label: profile.dietaryPreference,
        strictnessLabel: profile.dietaryPreferenceStrictness,
      },
    });
  } catch (error) {
    console.error("[Profile][Dietary] update failed", error);
    return NextResponse.json(
      { error: "Speichern der Ernährungsangaben ist fehlgeschlagen." },
      { status: 500 },
    );
  }
}
