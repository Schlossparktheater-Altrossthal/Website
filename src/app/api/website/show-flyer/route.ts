import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { readProductionFlyerSettings, saveProductionFlyerSettings } from "@/lib/production-flyer-settings";

const schema = z.object({ active: z.boolean(), title: z.string().nullable(), description: z.string().nullable() });

export async function GET() {
  const flyer = await readProductionFlyerSettings();
  return NextResponse.json({ active: flyer?.aktiv ?? false, title: flyer?.titel ?? null, description: flyer?.beschreibung ?? null, hasImage: Boolean(flyer?.bildData && flyer?.bildMimeType) });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PUBLIC.HOME.FLYER.EDIT"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  const saved = await saveProductionFlyerSettings({
    aktiv: parsed.data.active,
    titel: parsed.data.title,
    beschreibung: parsed.data.description,
  });
  return NextResponse.json({ active: saved.aktiv, title: saved.titel, description: saved.beschreibung, hasImage: Boolean(saved.bildData && saved.bildMimeType) });
}
