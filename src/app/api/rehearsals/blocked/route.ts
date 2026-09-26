import { NextRequest, NextResponse } from "next/server";

import { readDayAvailability } from "@/lib/calendar/day-availability";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const showId = await getActiveProductionId(session.user?.id ?? null);
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE", {
    showId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Datum fehlt" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
  }

  const availability = await readDayAvailability(date);
  return NextResponse.json({
    availability,
    userIds: Object.keys(availability).filter((userId) => availability[userId] === "blocked"),
  });
}
