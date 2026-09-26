import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolvePortalAccess, writeAuditLog } from "@/lib/datenportal/access";
import { portalRowsToCsv } from "@/lib/datenportal/csv";
import { executePortalQuery } from "@/lib/datenportal/execute";
import { dataPortalQuerySchema } from "@/lib/datenportal/fields";
import { PortalFieldError } from "@/lib/datenportal/run";
import { requireAuth } from "@/lib/rbac";

const requestSchema = dataPortalQuerySchema.extend({
  format: z.enum(["json", "csv"]).default("json"),
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
  if (!access.canView || (format === "csv" && !access.canExport)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  try {
    const result = await executePortalQuery(query, access);
    await writeAuditLog({
      userId,
      showId: query.showId,
      action: format === "csv" ? "export" : "query",
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
