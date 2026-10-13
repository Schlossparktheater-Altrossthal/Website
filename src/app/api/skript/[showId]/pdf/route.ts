import { NextResponse, type NextRequest } from "next/server";

import { renderPdfTemplate } from "@/lib/pdf/engine";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { scriptPdfOptionsSchema } from "@/lib/skript/pdf";
import { loadScriptReader } from "@/lib/skript/reader";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function list(value: string | null) {
  return value ? value.split(",").filter(Boolean) : [];
}

/**
 * Fassung als PDF mit den Leser-Einstellungen (docs/Plan/skript-plan.md, Phase 6).
 * `?fassung=<id>&rollen=a,b&regie=show|dim|hide&ohne=ton,licht&abblenden=1&groesse=0-3&deckblatt=0`
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> },
) {
  const session = await requireAuth();
  const { showId } = await params;
  const search = request.nextUrl.searchParams;
  const versionId = search.get("fassung") ?? "";

  const [canRead, canManage] = await Promise.all([
    hasPermission(session.user, SCRIPT_READ_PERMISSION, { showId }),
    hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId }),
  ]);
  if (!canRead && !canManage) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }
  const data = versionId ? await loadScriptReader(versionId, session.user?.id ?? null) : null;
  if (
    !data ||
    data.version.showId !== showId ||
    (!canManage && data.version.status !== "released")
  ) {
    return NextResponse.json({ error: "Fassung nicht gefunden." }, { status: 404 });
  }

  const parsed = scriptPdfOptionsSchema.safeParse({
    roleIds: list(search.get("rollen")),
    directions: search.get("regie") ?? undefined,
    hiddenCues: list(search.get("ohne")),
    dimOthers: search.get("abblenden") === "1",
    cover: search.get("deckblatt") !== "0",
    fontSize: search.has("groesse") ? Number(search.get("groesse")) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Einstellungen." }, { status: 400 });
  }
  const result = await renderPdfTemplate("skript-fassung", {
    title: data.version.showTitle,
    data,
    options: parsed.data,
  });
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${search.get("download") === "1" ? "attachment" : "inline"}; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
