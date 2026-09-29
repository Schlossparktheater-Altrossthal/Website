import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getActiveProduction } from "@/lib/active-production";
import { hasPermission } from "@/lib/permissions";
import { leaveProductionMembership } from "@/lib/produktionen/memberships";
import { revalidateShow } from "@/lib/produktionen/actions-helpers";
import { requireAuth } from "@/lib/rbac";

/**
 * Entfernt ein Mitglied aus der aktiven Produktion. Die Mitgliedschaft wird beendet
 * (`status: "left"` + `leftAt`), nicht gelöscht – die Person bleibt in der Historie.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const production = await getActiveProduction(session.user?.id);
  if (!production) {
    return NextResponse.json({ error: "Keine aktive Produktion ausgewählt" }, { status: 400 });
  }

  try {
    const left = await leaveProductionMembership({ showId: production.id, userId: id });
    if (!left) {
      return NextResponse.json(
        { error: "Das Mitglied ist nicht (mehr) in dieser Produktion" },
        { status: 404 },
      );
    }

    // Dashboard-Kennzahlen, Seitenleiste und Ensemble-Liste hängen an der Mitgliedschaft.
    revalidatePath("/mitglieder", "layout");
    revalidateShow(left.showId);

    return NextResponse.json({ ok: true, production: null });
  } catch (error) {
    console.error("[members] Entfernen aus der Produktion fehlgeschlagen", error);
    return NextResponse.json({ error: "Entfernen fehlgeschlagen" }, { status: 500 });
  }
}
