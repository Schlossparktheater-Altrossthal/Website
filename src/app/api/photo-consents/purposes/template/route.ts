import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { applyPhotoConsentTemplate } from "@/lib/photo-consent-purposes";
import { requireAuth } from "@/lib/rbac";

const applySchema = z.object({
  showId: z.string().min(1),
  template: z.string().min(1),
});

/** Wendet eine benannte Vorlage auf den Zweck-Katalog einer Produktion an. */
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const parsed = applySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  try {
    await applyPhotoConsentTemplate(parsed.data.showId, parsed.data.template);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unbekannte Vorlage")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[PhotoConsentTemplate] Apply failed", error);
    return NextResponse.json({ error: "Vorlage konnte nicht angewendet werden" }, { status: 500 });
  }
}
