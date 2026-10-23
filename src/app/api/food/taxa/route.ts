import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";

import { suggestTaxa } from "@/lib/food/taxon-suggestions";
import { loadTaxonIndex } from "@/lib/food/taxonomy/store";

/** GET /api/food/taxa?q=… – Vorschläge aus der Lebensmittel-Taxonomie (angemeldete Mitglieder). */
export const GET = withRoute({ name: "food/taxa.get" }, async ({ request }) => {
  try {
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) return NextResponse.json({ items: [] });
  try {
    const index = await loadTaxonIndex();
    return NextResponse.json({ items: suggestTaxa(index, query) });
  } catch (error) {
    console.error("[food.taxa] Suche fehlgeschlagen", error);
    return NextResponse.json({ error: "Suche nicht verfügbar" }, { status: 500 });
  }
});
