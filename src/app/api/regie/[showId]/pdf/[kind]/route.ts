import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";

import { getDirectionShows } from "@/lib/regie/access";
import {
  isDirectionPdfKind,
  parseBinderParts,
  renderDirectionBinder,
  renderDirectionPdf,
} from "@/lib/regie/pdf";
import { parseAvailabilityRange } from "@/lib/regie/availability-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDFs des Regie-Dashboards (docs/Plan/regie-plan.md). Die Daten lädt der Server selbst –
 * ohne Maße und Kontakte. Verfügbarkeit: `?ansicht=kerntage|wochen|termine&wochen=2`. Öffnet inline (Handy), `?download=1` speichert.
 * `mappe?teile=termine,szenen` erzeugt die Probenmappe aus den gewählten Teilen.
 */
export const GET = withRoute<{ showId: string; kind: string }>(
  { name: "regie/[showId]/pdf/[kind].get" },
  async ({ request, session, params }) => {
    const userId = session.user?.id;
    const { showId, kind } = params;
    if (!userId || (kind !== "mappe" && !isDirectionPdfKind(kind))) {
      return NextResponse.json({ error: "Unbekanntes PDF." }, { status: 404 });
    }
    const show = (await getDirectionShows(userId)).find((entry) => entry.id === showId);
    if (!show) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const query = request.nextUrl.searchParams;
    const range = parseAvailabilityRange(query.get("ansicht"), query.get("wochen"));
    const result =
      kind === "mappe"
        ? await renderDirectionBinder(
            parseBinderParts(request.nextUrl.searchParams.get("teile")),
            show,
            userId,
            range,
          )
        : await renderDirectionPdf(kind, show, userId, range);
    if (!result) {
      return NextResponse.json({ error: "Dafür gibt es noch keine Daten." }, { status: 404 });
    }
    const disposition =
      request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${result.filename.replace(/["\r\n\\]/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
