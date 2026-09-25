import { NextResponse } from "next/server";

import { readCalendarEventById } from "@/lib/calendar/entries";
import { calendarEventInputSchema, resolveCalendarEventTimes } from "@/lib/calendar/event-input";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type RouteParams = { params: Promise<{ id: string }> };

async function authorise() {
  const session = await requireAuth();
  if (!session.user?.id) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  if (!(await hasPermission(session.user, CALENDAR_PLANNER_PERMISSION))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  return null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const denied = await authorise();
  if (denied) return denied;
  const { id } = await params;

  const parsed = calendarEventInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const { start, end } = resolveCalendarEventTimes(input);
  const existing = await prisma.calendarEvent.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Termin wurde nicht gefunden." }, { status: 404 });
  }

  try {
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: input.title,
        kind: input.kind,
        start,
        end,
        allDay: input.allDay,
        location: input.location,
        description: input.description,
        showId: input.showId ?? null,
      },
    });
    return NextResponse.json(await readCalendarEventById(event.id));
  } catch (error) {
    console.error("[calendar-events:update]", error);
    return NextResponse.json({ error: "Termin konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const denied = await authorise();
  if (denied) return denied;
  const { id } = await params;

  try {
    const result = await prisma.calendarEvent.deleteMany({ where: { id } });
    if (!result.count) {
      return NextResponse.json({ error: "Termin wurde nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[calendar-events:delete]", error);
    return NextResponse.json({ error: "Termin konnte nicht gelöscht werden." }, { status: 500 });
  }
}
