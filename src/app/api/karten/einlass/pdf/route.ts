import { NextResponse, type NextRequest } from "next/server";

import { actorMayAccessShow, getTicketActor } from "@/lib/karten/access";
import { loadDoorSnapshot } from "@/lib/karten/checkin";
import {
  formatPerformanceDateLong,
  formatPrice,
  RESERVATION_SOURCE_LABELS,
} from "@/lib/karten/constants";
import { showDisplayTitle } from "@/lib/karten/mails";
import { loadPerformances, loadTicketCategories } from "@/lib/karten/queries";
import { DEFAULT_TIME_ZONE } from "@/lib/format/date";
import { renderPdfTemplate } from "@/lib/pdf/engine";
import { prisma } from "@/lib/prisma";
import type { ReservationSource } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRows(snapshot: Awaited<ReturnType<typeof loadDoorSnapshot>>) {
  return [...snapshot.guests]
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
        [
          guest.status === "pending" ? "unbestätigt" : null,
          guest.source === "free_ticket"
            ? `${RESERVATION_SOURCE_LABELS[guest.source as ReservationSource]}${
                guest.via ? ` über ${guest.via}` : ""
              }`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
    }));
}

/**
 * Abhakbare Einlassliste als PDF (Notfall ohne Netz/Akku, Sekretariat). `eventId` für eine
 * Vorstellung, `showId` für alle kommenden Vorstellungen der Produktion in einer Datei.
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  const showId = request.nextUrl.searchParams.get("showId") ?? "";
  const actor = await getTicketActor();
  if (!actor || !(actor.canCheckIn || actor.canOffice)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  let show: { id: string; title: string | null; year: number; revealedAt: Date | null } | null =
    null;
  let events: { id: string; start: Date }[] = [];
  if (eventId) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        start: true,
        kind: true,
        show: { select: { id: true, title: true, year: true, revealedAt: true } },
      },
    });
    if (event?.show && event.kind === "PERFORMANCE") {
      show = event.show;
      events = [event];
    }
  } else if (showId) {
    show = await prisma.show.findUnique({
      where: { id: showId },
      select: { id: true, title: true, year: true, revealedAt: true },
    });
    if (show) {
      const performances = await loadPerformances(show.id, { now: new Date() });
      events = performances
        .filter((row) => row.configured && !row.cancelled)
        .map((row) => ({ id: row.eventId, start: row.start }));
    }
  }
  if (!show || !actorMayAccessShow(actor, show.id)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }
  if (events.length === 0) {
    return NextResponse.json({ error: "Keine Vorstellung gefunden." }, { status: 404 });
  }

  const [snapshots, categories] = await Promise.all([
    Promise.all(events.map((event) => loadDoorSnapshot(event.id))),
    loadTicketCategories(show.id, { activeOnly: true }),
  ]);
  const generatedAt = new Intl.DateTimeFormat("de-DE", {
    timeZone: DEFAULT_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const result = await renderPdfTemplate("door-checklist", {
    showTitle: showDisplayTitle(show),
    generatedAt,
    categories: categories.map((category) => category.name),
    sections: events.map((event, index) => ({
      performance: formatPerformanceDateLong(event.start),
      capacity: snapshots[index].capacity,
      rows: toRows(snapshots[index]),
    })),
  });
  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
