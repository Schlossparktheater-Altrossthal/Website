import { NextResponse, type NextRequest } from "next/server";

import { actorMayAccessShow, getTicketActor } from "@/lib/karten/access";
import { loadDoorSnapshot } from "@/lib/karten/checkin";
import {
  formatPerformanceDateLong,
  formatPrice,
  RESERVATION_SOURCE_LABELS,
} from "@/lib/karten/constants";
import { showDisplayTitle } from "@/lib/karten/mails";
import { loadTicketCategories } from "@/lib/karten/queries";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { renderPdfTemplate } from "@/lib/pdf/engine";
import { prisma } from "@/lib/prisma";
import type { ReservationSource } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Abhakbare Einlassliste einer Vorstellung als PDF (Notfall ohne Netz/Akku). */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  const actor = await getTicketActor();
  const event = eventId
    ? await prisma.calendarEvent.findUnique({
        where: { id: eventId },
        select: {
          start: true,
          kind: true,
          show: { select: { id: true, title: true, year: true } },
        },
      })
    : null;
  if (
    !actor ||
    !(actor.canCheckIn || actor.canOffice) ||
    !event?.show ||
    event.kind !== "PERFORMANCE" ||
    !actorMayAccessShow(actor, event.show.id)
  ) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const [snapshot, categories] = await Promise.all([
    loadDoorSnapshot(eventId),
    loadTicketCategories(event.show.id, { activeOnly: true }),
  ]);
  const rows = [...snapshot.guests]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((guest) => ({
      name: guest.name,
      code: guest.code,
      summary: guest.summary,
      tickets: guest.tickets,
      checkedIn: guest.checkedIn,
      open: guest.openCents > 0 ? formatPrice(guest.openCents) : null,
      note: guest.note,
      tag:
        guest.status === "pending"
          ? "unbestätigt"
          : guest.source === "free_ticket"
            ? RESERVATION_SOURCE_LABELS[guest.source as ReservationSource]
            : null,
    }));
  const generatedAt = new Intl.DateTimeFormat("de-DE", {
    timeZone: DEFAULT_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const result = await renderPdfTemplate("door-checklist", {
    showTitle: showDisplayTitle(event.show),
    performance: formatPerformanceDateLong(event.start),
    generatedAt,
    capacity: snapshot.capacity,
    categories: categories.map((category) => category.name),
    rows,
  });
  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
