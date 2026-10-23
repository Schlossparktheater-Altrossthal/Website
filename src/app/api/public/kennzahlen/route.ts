import { NextResponse } from "next/server";

import { loadPublicStats } from "@/lib/public-site/stats";

// Öffentliche Kennzahlen für „Über uns“ auf der Drupal-Website. Nur Zahlen, keine Personendaten.

export const dynamic = "force-dynamic";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

export async function GET() {
  return NextResponse.json(await loadPublicStats(), { headers: HEADERS });
}
