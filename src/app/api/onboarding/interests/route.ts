import { NextRequest, NextResponse } from "next/server";

import { hasOnboardingSuggestionAccess } from "@/lib/onboarding/suggestion-access";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (!(await hasOnboardingSuggestionAccess(request))) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const interests = await prisma.interest.findMany({
    include: {
      _count: { select: { userInterest: true } },
    },
    orderBy: [{ userInterest: { _count: "desc" } }, { name: "asc" }],
    take: 50,
  });

  return NextResponse.json({
    interests: interests.map((interest) => ({
      id: interest.id,
      name: interest.name,
      usage: interest._count.userInterest,
    })),
  });
}
