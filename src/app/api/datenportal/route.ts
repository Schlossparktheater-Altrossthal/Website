import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolvePortalAccess, writeAuditLog } from "@/lib/datenportal/access";
import { formatValue, portalRowsToCsv } from "@/lib/datenportal/csv";
import { portalRowsToXlsx } from "@/lib/datenportal/xlsx";
import { executePortalQuery } from "@/lib/datenportal/execute";
import { DATA_SOURCE_LABELS, dataPortalQuerySchema } from "@/lib/datenportal/fields";
import { PortalFieldError } from "@/lib/datenportal/run";
import { renderPdfTemplate } from "@/lib/pdf/engine";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const requestSchema = dataPortalQuerySchema.extend({
  format: z.enum(["json", "csv", "xlsx", "pdf"]).default("json"),
});

const MAX_ROWS = 5000;

function slugify(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "auswertung"
  );
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Abfrage" }, { status: 400 });
  }
  const { format, ...query } = parsed.data;

  const access = await resolvePortalAccess(session.user, query.showId);
  if (!access.canView || (format !== "json" && !access.canExport)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  try {
    const result = await executePortalQuery(query, access);
    await writeAuditLog({
      userId,
      showId: query.showId,
      action: format === "json" ? "query" : "export",
      source: query.source,
      fields: result.columns.map((column) => column.key),
      rowCount: result.rows.length,
    });

    if (format === "csv") {
      return new NextResponse(portalRowsToCsv(result.columns, result.rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="datenportal-${slugify(query.source)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    if (format === "pdf") {
      const show = await prisma.show.findUnique({
        where: { id: query.showId },
        select: { title: true, year: true },
      });
      const pdf = await renderPdfTemplate("data-portal-table", {
        title: DATA_SOURCE_LABELS[query.source],
        subtitle: show ? `Produktion: ${show.title?.trim() || show.year}` : null,
        generatedAt: new Date(),
        columns: result.columns.map((column) => column.label),
        rows: result.rows.map((row) =>
          result.columns.map((column) => formatValue(row[column.key] ?? null)),
        ),
      });
      return new NextResponse(new Uint8Array(pdf.buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="datenportal-${slugify(query.source)}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    if (format === "xlsx") {
      return new NextResponse(new Uint8Array(await portalRowsToXlsx(result.columns, result.rows)), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="datenportal-${slugify(query.source)}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json(
      {
        columns: result.columns,
        rows: result.rows.slice(0, MAX_ROWS),
        total: result.rows.length,
        truncated: result.rows.length > MAX_ROWS,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PortalFieldError) {
      return NextResponse.json({ error: "Feld nicht verfügbar" }, { status: 403 });
    }
    throw error;
  }
}
