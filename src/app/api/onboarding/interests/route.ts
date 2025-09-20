import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
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
