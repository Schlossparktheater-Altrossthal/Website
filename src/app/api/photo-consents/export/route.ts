import { NextRequest, NextResponse } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  loadPhotoConsentOverview,
  photoConsentOverviewToCsv,
} from "@/lib/produktionen/photo-consent-overview";
import { requireAuth } from "@/lib/rbac";

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "produktion"
  );
}

/** CSV-Liste für Fotograf:innen: wer darf fotografiert werden, wer nicht. */
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const [canManageConsents, canManageShow] = await Promise.all([
    hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"),
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
  ]);
  if (!canManageConsents && !canManageShow) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const showId = request.nextUrl.searchParams.get("showId")?.trim();
  if (!showId) {
    return NextResponse.json({ error: "Produktion fehlt" }, { status: 400 });
  }
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { title: true, year: true },
  });
  if (!show) {
    return NextResponse.json({ error: "Produktion nicht gefunden" }, { status: 404 });
  }

  const rows = await loadPhotoConsentOverview(showId);
  const fileName = `fotoerlaubnis-${slugify(show.title ?? String(show.year))}-${show.year}.csv`;
  return new NextResponse(photoConsentOverviewToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
