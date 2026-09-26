import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";
import { broadcastOnboardingDashboardForUser } from "@/lib/onboarding/dashboard-events";
import {
  normalizeInterest,
  replaceUserInterests,
  type NormalizedInterest,
} from "@/lib/profil/interests";

export async function GET() {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const interests = await prisma.userInterest.findMany({
    where: { userId },
    include: { interest: { select: { name: true } } },
    orderBy: { interest: { name: "asc" } },
  });

  return NextResponse.json({
    interests: interests
      .map((entry) => entry.interest?.name ?? "")
      .filter((name) => Boolean(name?.trim())),
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { interests?: unknown }).interests)
  ) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const rawInterests = (payload as { interests: unknown[] }).interests;
  const seen = new Set<string>();
  const normalized: NormalizedInterest[] = [];

  for (const raw of rawInterests) {
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "Interessen müssen Text sein" }, { status: 400 });
    }
    const entry = normalizeInterest(raw);
    if (!entry) {
      continue;
    }
    if (seen.has(entry.lower)) {
      continue;
    }
    seen.add(entry.lower);
    normalized.push(entry);
    if (normalized.length > MAX_INTERESTS_PER_USER) {
      return NextResponse.json(
        { error: `Maximal ${MAX_INTERESTS_PER_USER} Interessen erlaubt` },
        { status: 400 },
      );
    }
  }

  try {
    const updatedNames = await prisma.$transaction((tx) =>
      replaceUserInterests(tx, userId, normalized),
    );

    try {
      await broadcastOnboardingDashboardForUser(userId);
    } catch (error) {
      console.error("[profile.interests] realtime update failed", error);
    }

    return NextResponse.json({ ok: true, interests: updatedNames });
  } catch (error) {
    console.error("[profile.interests]", error);
    return NextResponse.json(
      { error: "Aktualisierung der Interessen fehlgeschlagen" },
      { status: 500 },
    );
  }
}
