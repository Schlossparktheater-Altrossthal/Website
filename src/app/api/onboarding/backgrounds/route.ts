import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const profiles = await prisma.memberOnboardingProfile.findMany({
    select: { background: true },
    where: { background: { not: null } },
  });

  const counts = new Map<string, { name: string; count: number }>();

  for (const entry of profiles) {
    const raw = entry.background ?? "";
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { name: normalized, count: 1 });
    }
  }

  const backgrounds = Array.from(counts.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "de");
    })
    .slice(0, 20);

  return NextResponse.json({ backgrounds });
}
