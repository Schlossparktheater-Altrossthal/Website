import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";
import { broadcastOnboardingDashboardForUser } from "@/lib/onboarding/dashboard-events";

const MAX_INTEREST_LENGTH = 80;

type NormalizedInterest = { value: string; lower: string };

function normalizeInterest(raw: string): NormalizedInterest | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const limited = trimmed.slice(0, MAX_INTEREST_LENGTH);
  const lower = limited.toLowerCase();
  return { value: limited, lower };
}

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
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { interests?: unknown }).interests)) {
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
    const updatedNames = await prisma.$transaction(async (tx) => {
      const existing = await tx.userInterest.findMany({
        where: { userId },
        include: { interest: { select: { id: true, name: true } } },
      });

      const targetLowers = new Set(normalized.map((entry) => entry.lower));
      const keepMap = new Map<string, { interestId: string }>();
      const removeIds: string[] = [];

      for (const link of existing) {
        const interestName = link.interest?.name ?? "";
        const lower = interestName.toLowerCase();
        if (targetLowers.has(lower)) {
          keepMap.set(lower, { interestId: link.interestId });
        } else {
          removeIds.push(link.id);
        }
      }

      if (removeIds.length) {
        await tx.userInterest.deleteMany({ where: { id: { in: removeIds } } });
      }

      if (!normalized.length) {
        return [] as string[];
      }

      const filters = normalized.map((entry) => ({
        name: { equals: entry.value, mode: "insensitive" as const },
      }));

      let interestRecords = await tx.interest.findMany({
        where: { OR: filters },
      });

      const interestByLower = new Map<string, { id: string; name: string }>();
      for (const record of interestRecords) {
        interestByLower.set(record.name.toLowerCase(), { id: record.id, name: record.name });
      }

      const toCreate = normalized
        .filter((entry) => !interestByLower.has(entry.lower))
        .map((entry) => ({ name: entry.value, createdById: userId }));

      if (toCreate.length) {
        await tx.interest.createMany({ data: toCreate, skipDuplicates: true });
        interestRecords = await tx.interest.findMany({ where: { OR: filters } });
        interestByLower.clear();
        for (const record of interestRecords) {
          interestByLower.set(record.name.toLowerCase(), { id: record.id, name: record.name });
        }
      }

      const toLink = normalized
        .filter((entry) => !keepMap.has(entry.lower))
        .map((entry) => {
          const interest = interestByLower.get(entry.lower);
          if (!interest) return null;
          return { userId, interestId: interest.id };
        })
        .filter((entry): entry is { userId: string; interestId: string } => Boolean(entry));

      if (toLink.length) {
        await tx.userInterest.createMany({ data: toLink, skipDuplicates: true });
      }

      return normalized.map((entry) => interestByLower.get(entry.lower)?.name ?? entry.value);
    });

    try {
      await broadcastOnboardingDashboardForUser(userId);
    } catch (error) {
      console.error("[profile.interests] realtime update failed", error);
    }

    return NextResponse.json({ ok: true, interests: updatedNames });
  } catch (error) {
    console.error("[profile.interests]", error);
    return NextResponse.json({ error: "Aktualisierung der Interessen fehlgeschlagen" }, { status: 500 });
  }
}
