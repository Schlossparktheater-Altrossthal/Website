import { NextResponse } from "next/server";

import { readCalendarEventById } from "@/lib/calendar/entries";
import { calendarEventInputSchema, resolveCalendarEventTimes } from "@/lib/calendar/event-input";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  if (!(await hasPermission(session.user, CALENDAR_PLANNER_PERMISSION))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const parsed = calendarEventInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const { start, end } = resolveCalendarEventTimes(input);
  try {
    const event = await prisma.calendarEvent.create({
      data: {
        title: input.title,
        kind: input.kind,
        start,
        end,
        allDay: input.allDay,
        location: input.location,
        description: input.description,
        showId: input.showId ?? null,
        createdById: userId,
      },
    });
    return NextResponse.json(await readCalendarEventById(event.id), { status: 201 });
  } catch (error) {
    console.error("[calendar-events:create]", error);
    return NextResponse.json({ error: "Termin konnte nicht gespeichert werden." }, { status: 500 });
  }
}
