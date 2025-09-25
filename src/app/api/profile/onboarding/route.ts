import { NextRequest, NextResponse } from "next/server";
import { OnboardingFocus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const CURRENT_YEAR = new Date().getFullYear();

const optionalTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const onboardingUpdateSchema = z.object({
  focus: z.nativeEnum(OnboardingFocus),
  background: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "Bitte beschreibe kurz deinen schulischen oder beruflichen Hintergrund.",
    })
    .refine((value) => value.length <= 200, {
      message: "Bitte nutze maximal 200 Zeichen für deinen Hintergrund.",
    }),
  backgroundClass: optionalTrimmedString.refine(
    (value) => !value || value.length <= 120,
    "Klassenangaben dürfen maximal 120 Zeichen enthalten.",
  ),
  notes: optionalTrimmedString.refine(
    (value) => !value || value.length <= 2000,
    "Notizen dürfen maximal 2000 Zeichen enthalten.",
  ),
  memberSinceYear: z
    .union([
      z
        .number()
        .int()
        .min(1900, {
          message: `Bitte gib ein Jahr zwischen 1900 und ${CURRENT_YEAR} an.`,
        })
        .max(CURRENT_YEAR, {
          message: `Bitte gib ein Jahr zwischen 1900 und ${CURRENT_YEAR} an.`,
        }),
      z.null(),
      z.undefined(),
    ])
    .transform((value) => (value === undefined ? null : value)),
});

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

  const result = onboardingUpdateSchema.safeParse(payload);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Ungültige Eingaben.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = result.data;

  try {
    const profile = await prisma.memberOnboardingProfile.upsert({
      where: { userId },
      update: {
        focus: data.focus,
        background: data.background,
        backgroundClass: data.backgroundClass,
        notes: data.notes,
        memberSinceYear: data.memberSinceYear,
      },
      create: {
        userId,
        focus: data.focus,
        background: data.background,
        backgroundClass: data.backgroundClass,
        notes: data.notes,
        memberSinceYear: data.memberSinceYear,
      },
      select: {
        focus: true,
        background: true,
        backgroundClass: true,
        notes: true,
        memberSinceYear: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      onboarding: {
        focus: profile.focus,
        background: profile.background ?? null,
        backgroundClass: profile.backgroundClass ?? null,
        notes: profile.notes ?? null,
        memberSinceYear: profile.memberSinceYear ?? null,
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Profile][Onboarding] update failed", error);
    return NextResponse.json(
      { error: "Onboarding konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
