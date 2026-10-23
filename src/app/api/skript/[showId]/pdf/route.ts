import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";

import { renderPdfTemplate } from "@/lib/pdf/engine";
import { hasPermission } from "@/lib/permissions";
import { loadReaderAnnotations } from "@/lib/skript/annotations";
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
 * `&fuer=<userId>&zeigen=both|role|name` – personalisiert für ein Mitglied der Produktion; ohne
 * `rollen` gelten dessen Rollen laut Besetzung.
 * `&teile=roleStats,sceneTable,script,…&spalten=roles,words,ton&matrix=mark|words|passages` –
 * Abschnitte in Reihenfolge (docs/Plan/skript-auswertungen-plan.md, Phase 3).
 * `&kopf=roles,mine,cues,…&kopfnurmeine=1` – Szenenkopf wie im Leser, fürs Papier gesetzt
 * (docs/Plan/skript-ansicht-plan.md). `&notizen=1` – eigene Notizen mitdrucken.
 */
export const GET = withRoute<{ showId: string }>(
  { name: "skript/[showId]/pdf.get" },
  async ({ request, session, params }) => {
    const { showId } = params;
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

    const person = data.people.find((p) => p.id === search.get("fuer")) ?? null;
    if (search.get("fuer") && !person) {
      return NextResponse.json({ error: "Person nicht in dieser Produktion." }, { status: 400 });
    }
    const roleIds = list(search.get("rollen"));
    const parsed = scriptPdfOptionsSchema.safeParse({
      roleIds: roleIds.length ? roleIds : (person?.roleIds ?? []),
      personId: person?.id ?? null,
      personShow: search.get("zeigen") ?? undefined,
      sections: search.has("teile") ? list(search.get("teile")) : undefined,
      sceneColumns: search.has("spalten") ? list(search.get("spalten")) : undefined,
      matrixCell: search.get("matrix") ?? undefined,
      directions: search.get("regie") ?? undefined,
      hiddenCues: list(search.get("ohne")),
      dimOthers: search.get("abblenden") === "1",
      cover: search.get("deckblatt") !== "0",
      fontSize: search.has("groesse") ? Number(search.get("groesse")) : undefined,
      sceneHeader: search.has("kopf") ? list(search.get("kopf")).filter((v) => v !== "-") : null,
      sceneHeaderOnlyMine: search.get("kopfnurmeine") === "1",
      notes: search.get("notizen") === "1",
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Einstellungen." }, { status: 400 });
    }
    // Eigene Notizen nur von der Person, die das PDF erzeugt – nie die eines anderen Mitglieds.
    const userId = session.user?.id ?? null;
    const notes =
      parsed.data.notes && userId
        ? await loadReaderAnnotations(showId, data.version.id, userId, data.blocks)
        : [];
    const result = await renderPdfTemplate("skript-fassung", {
      title: data.version.showTitle,
      data,
      options: parsed.data,
      personName: person?.name ?? null,
      notes,
    });
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${search.get("download") === "1" ? "attachment" : "inline"}; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
