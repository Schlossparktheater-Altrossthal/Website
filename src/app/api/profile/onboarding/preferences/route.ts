import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getActiveProductionId } from "@/lib/active-production";
import { replaceProductionPreferences } from "@/lib/onboarding/production-preferences";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  getRolePreferenceDefinition,
  isCustomRolePreference,
} from "@/lib/onboarding/role-preferences";
import { broadcastOnboardingDashboardForUser } from "@/lib/onboarding/dashboard-events";
import { deriveOnboardingFocusFromPreferences } from "@/lib/onboarding/role-preference-utils";

const preferenceSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(120)
    .transform((value) => value.trim()),
  domain: z.enum(["acting", "crew"]),
  weight: z.number().int().min(0).max(100),
});

const payloadSchema = z.object({
  preferences: z.array(preferenceSchema).max(32),
});

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const parseResult = payloadSchema.safeParse(json);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const seenCodes = new Set<string>();
  const sanitized: Array<{ code: string; domain: "acting" | "crew"; weight: number }> = [];

  for (const entry of parseResult.data.preferences) {
    const code = entry.code;
    if (!code) {
      continue;
    }
    if (seenCodes.has(code)) {
      continue;
    }
    seenCodes.add(code);

    const definition = getRolePreferenceDefinition(code);
    if (definition) {
      if (definition.domain !== entry.domain) {
        return NextResponse.json(
          { error: "Unzulässige Kombination aus Rolle und Bereich." },
          { status: 400 },
        );
      }
    } else if (!isCustomRolePreference(code)) {
      return NextResponse.json({ error: "Unbekannte Präferenz." }, { status: 400 });
    }

    const normalizedWeight = Math.max(0, Math.min(100, entry.weight));
    if (normalizedWeight <= 0) {
      continue;
    }

    sanitized.push({ code, domain: entry.domain, weight: normalizedWeight });
  }

  try {
    const showId = await getActiveProductionId(userId);
    const { preferences: updated, focus: nextFocus } = await prisma.$transaction(async (tx) => {
      await replaceProductionPreferences(tx, userId, showId, sanitized);
      // Direkt lesen: Nach dem Leeren sollen keine Vorschläge aus früheren Produktionen erscheinen.
      const preferences = await tx.memberRolePreference.findMany({
        where: { userId, showId },
        select: { code: true, domain: true, weight: true },
        orderBy: [{ domain: "asc" }, { code: "asc" }],
      });

      const focus = deriveOnboardingFocusFromPreferences(preferences);
      if (focus) {
        await tx.memberOnboardingProfile.upsert({
          where: { userId },
          update: { focus },
          create: { userId, focus },
        });
        if (showId) {
          await tx.productionOnboarding.updateMany({ where: { userId, showId }, data: { focus } });
        }
      }

      return { preferences, focus };
    });

    try {
      await broadcastOnboardingDashboardForUser(userId);
    } catch (error) {
      console.error("[profile.onboarding.preferences] realtime update failed", error);
    }

    return NextResponse.json({
      preferences: updated.map((pref) => ({
        code: pref.code,
        domain: pref.domain,
        weight: pref.weight,
      })),
      focus: nextFocus ?? null,
    });
  } catch (error) {
    console.error("[profile.onboarding.preferences]", error);
    return NextResponse.json(
      { error: "Onboarding-Präferenzen konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
