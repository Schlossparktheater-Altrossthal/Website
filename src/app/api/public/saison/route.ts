import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { PUBLIC_TICKETS_PATH } from "@/lib/karten/constants";
import { loadPublicSeason, publicSeasonMaxAge } from "@/lib/public-site/season";

// Öffentliche Schnittstelle für die Drupal-Website (Countdown, Spielplan): Termine der nächsten
// Saison; Stücktitel erst ab dem Enthüllungsdatum. Keine Personendaten, daher für alle Origins.

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  const now = new Date();
  const season = await loadPublicSeason(now);
  const maxAge = publicSeasonMaxAge(season, now);
  return NextResponse.json(
    { bookingUrl: `${getAppBaseUrl()}${PUBLIC_TICKETS_PATH}`, season },
    {
      headers: {
        ...CORS,
        "Cache-Control":
          maxAge > 0 ? `public, max-age=${maxAge}, stale-while-revalidate=${maxAge}` : "no-store",
      },
    },
  );
}
