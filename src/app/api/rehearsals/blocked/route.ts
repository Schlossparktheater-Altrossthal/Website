import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

function parseDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.probenplanung");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Datum fehlt" }, { status: 400 });
  }

  const dayStart = parseDate(date);
  if (!dayStart) {
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
  }
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const blocked = await prisma.blockedDay.findMany({
    where: {
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
      kind: "BLOCKED",
    },
    select: { userId: true },
  });

  return NextResponse.json({ userIds: blocked.map((entry) => entry.userId) });
}
