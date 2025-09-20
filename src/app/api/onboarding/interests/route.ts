import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const interests = await prisma.interest.findMany({
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({
    interests: interests.map((interest) => ({ id: interest.id, name: interest.name })),
  });
}
