import { NextResponse } from "next/server";

import { parseFeedToken, renderCalendarFeed } from "@/lib/calendar/feed";

// Kalender-Apps rufen ohne Anmeldung ab – der geheime Token im Pfad ist die Berechtigung.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token: segment } = await context.params;
  const token = parseFeedToken(segment);
  const body = token ? await renderCalendarFeed(token) : null;
  if (!body) {
    return new NextResponse("Kalender nicht gefunden", { status: 404 });
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="termine.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
