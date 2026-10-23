import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getActiveProduction } from "@/lib/active-production";
import { leaveProductionMembership } from "@/lib/produktionen/memberships";
import { revalidateShow } from "@/lib/produktionen/actions-helpers";

/**
 * Entfernt ein Mitglied aus der aktiven Produktion. Die Mitgliedschaft wird beendet
 * (`status: "left"` + `leftAt`), nicht gelöscht – die Person bleibt in der Historie.
 */
export const DELETE = withRoute<{ id: string }>(
  { name: "members/[id]/production.delete", permission: "PRIVATE.ADMIN.MEMBERS.MANAGE" },
  async ({ session, params }) => {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    const production = await getActiveProduction(session.user?.id);
    if (!production) {
      return NextResponse.json({ error: "Keine Produktion ausgewählt" }, { status: 400 });
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
  },
);
