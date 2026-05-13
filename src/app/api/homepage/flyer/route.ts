import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { readProductionFlyerSettings, saveProductionFlyerSettings } from "@/lib/production-flyer-settings";

const schema = z.object({ aktiv: z.boolean(), titel: z.string().nullable(), beschreibung: z.string().nullable() });

export async function GET() {
  const flyer = await readProductionFlyerSettings();
  return NextResponse.json({ aktiv: flyer?.aktiv ?? false, titel: flyer?.titel ?? null, beschreibung: flyer?.beschreibung ?? null, hasBild: Boolean(flyer?.bildData && flyer?.bildMimeType) });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.countdown"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  const saved = await saveProductionFlyerSettings(parsed.data);
  return NextResponse.json({ aktiv: saved.aktiv, titel: saved.titel, beschreibung: saved.beschreibung, hasBild: Boolean(saved.bildData && saved.bildMimeType) });
}
