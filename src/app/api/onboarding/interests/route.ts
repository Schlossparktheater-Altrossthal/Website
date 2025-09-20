import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
