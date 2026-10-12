import { NextResponse } from "next/server";

import { getEventMediaAccess } from "@/lib/media/event-media";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

/** Gemeinsamer Einstieg der Medien-Routen: Sitzung, Termin und Rechte. */
export async function loadMediaContext(eventId: string) {
  const session = await getSession();
  const user = session?.user;
  if (!user?.id || user.isDeactivated) {
    return { error: NextResponse.json({ error: "Bitte anmelden." }, { status: 401 }) } as const;
  }
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      showId: true,
      title: true,
      start: true,
      show: { select: { year: true, title: true } },
    },
  });
  if (!event) {
    return {
      error: NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 }),
    } as const;
  }
  const access = await getEventMediaAccess(user, event);
  if (!access.canUse) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung für diesen Termin." }, { status: 403 }),
    } as const;
  }
  return { user: { ...user, id: user.id }, event, access } as const;
}
