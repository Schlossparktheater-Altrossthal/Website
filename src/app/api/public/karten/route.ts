import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { PUBLIC_TICKETS_PATH } from "@/lib/karten/constants";
import { showDisplayTitle } from "@/lib/karten/mails";
import { loadPublicShow, loadPublicShows } from "@/lib/karten/queries";

// Öffentliche Schnittstelle für die Drupal-Website: kommende Vorstellungen mit Buchungsstand
// und Link zur Reservierung. Keine Personen- oder Buchungsdaten, daher für alle Origins lesbar
// und kurz cachebar.

export const dynamic = "force-dynamic";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

export async function GET() {
  const base = getAppBaseUrl();
  const now = new Date();
  const shows = await loadPublicShows(now);
  const data = await Promise.all(
    shows.map(async (show) => {
      const detail = await loadPublicShow(show.id, now);
      const url = `${base}${PUBLIC_TICKETS_PATH}/${show.id}`;
      return {
        id: show.id,
        title: showDisplayTitle(show),
        year: show.year,
        url,
        performances: (detail?.performances ?? []).map((row) => ({
          id: row.eventId,
          start: row.start.toISOString(),
          location: row.location,
          status: row.cancelled
            ? "cancelled"
            : row.salesClosed
              ? "box_office_only"
              : row.level === "sold_out"
                ? "sold_out"
                : row.level === "few"
                  ? "few"
                  : "available",
          url: `${url}?vorstellung=${encodeURIComponent(row.eventId)}`,
        })),
        prices: (detail?.categories ?? []).map((category) => ({
          name: category.name,
          description: category.description,
          priceCents: category.priceCents,
        })),
      };
    }),
  );
  return NextResponse.json(
    { bookingUrl: `${base}${PUBLIC_TICKETS_PATH}`, shows: data },
    { headers: HEADERS },
  );
}
