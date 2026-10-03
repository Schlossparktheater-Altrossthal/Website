import { NextRequest, NextResponse } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { renderPdfTemplate } from "@/lib/pdf/engine";
import { prisma } from "@/lib/prisma";
import {
  PHOTO_PERMISSION_LABELS,
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

/** Liste für Fotograf:innen als CSV oder PDF: wer darf fotografiert werden, wer nicht. */
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const [canManageConsents, canManageShow, canView] = await Promise.all([
    hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"),
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    hasPermission(session.user, "PRIVATE.PHOTOCONSENT.VIEW"),
  ]);
  if (!canManageConsents && !canManageShow && !canView) {
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

  const overview = await loadPhotoConsentOverview(showId);
  const baseName = `fotoerlaubnis-${slugify(show.title ?? String(show.year))}-${show.year}`;
  const format = request.nextUrl.searchParams.get("format")?.trim().toLowerCase();

  if (format === "pdf") {
    const result = await renderPdfTemplate("photo-consent-list", {
      showTitle: show.title ?? `Produktion ${show.year}`,
      generatedAt: new Date(),
      rows: overview.rows.map((row) => ({
        name: row.name,
        permission: PHOTO_PERMISSION_LABELS[row.permission],
        exclusionNote: row.exclusionNote,
        isMinor: row.isMinor,
      })),
    });
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(photoConsentOverviewToCsv(overview), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
