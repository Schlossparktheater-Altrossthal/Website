import { NextRequest, NextResponse } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { loadPhotoConsentOverview } from "@/lib/produktionen/photo-consent-overview";
import { requireAuth } from "@/lib/rbac";

const PHOTO_CONSENT_VIEW_PERMISSION = "PRIVATE.PHOTOCONSENT.VIEW";
const PHOTO_CONSENT_MANAGE_PERMISSION = "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE";

/**
 * Lesezugriff für Fotograf:innen: alle Produktionen plus die Fotoliste einer ausgewählten
 * Produktion. Zugänglich mit `VIEW` oder `MANAGE`.
 */
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const [canView, canManage] = await Promise.all([
    hasPermission(session.user, PHOTO_CONSENT_VIEW_PERMISSION),
    hasPermission(session.user, PHOTO_CONSENT_MANAGE_PERMISSION),
  ]);
  if (!canView && !canManage) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const shows = await prisma.show.findMany({
    orderBy: [{ year: "desc" }],
    select: { id: true, title: true, year: true, status: true },
  });

  const requestedShowId = request.nextUrl.searchParams.get("showId")?.trim() ?? null;
  const selected = shows.find((show) => show.id === requestedShowId) ?? shows[0] ?? null;

  if (!selected) {
    return NextResponse.json({ shows, showId: null, showTitle: null, purposes: [], rows: [] });
  }

  const overview = await loadPhotoConsentOverview(selected.id);
  return NextResponse.json({
    shows: shows.map((show) => ({
      id: show.id,
      title: show.title ?? `Produktion ${show.year}`,
      year: show.year,
      status: show.status,
    })),
    showId: selected.id,
    showTitle: selected.title ?? `Produktion ${selected.year}`,
    purposes: overview.purposes,
    rows: overview.rows,
  });
}
