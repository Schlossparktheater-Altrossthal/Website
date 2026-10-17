import { NextResponse, type NextRequest } from "next/server";

import { createAuthentikLoginLink, isManagedAuthentikUser } from "@/lib/authentik/client";
import { isAuthentikProvisioningEnabled } from "@/lib/authentik/config";
import {
  ensureAuthentikUserForMember,
  memberIdentitySelect,
  toMemberIdentity,
} from "@/lib/authentik/sync";
import { createLogger } from "@/lib/logger";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const logger = createLogger("authentik-member-login");

/** Gültigkeit des Links (Authentik-Standard für Tokens). */
const LINK_MINUTES = 30;

/**
 * Anmeldelink ohne Passwort (docs/Plan/regie-plan.md, Phase 2): legt das
 * Theater-Konto bei Bedarf an und liefert einen Einmal-Link, über den die
 * Person einen Passkey einrichtet. Der Admin schickt ihn per Messenger oder
 * lässt ihn vor Ort als QR-Code scannen.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  if (!isAuthentikProvisioningEnabled()) {
    return NextResponse.json(
      { error: "Theater-Konten sind hier nicht verwaltbar" },
      { status: 503 },
    );
  }

  const { id } = await params;
  const member = await prisma.user.findUnique({ where: { id }, select: memberIdentitySelect });
  const identity = member ? toMemberIdentity(member) : null;
  if (!identity) {
    return NextResponse.json({ error: "Mitglied hat keine E-Mail-Adresse" }, { status: 400 });
  }
  try {
    const { user: authentikUser } = await ensureAuthentikUserForMember(identity);
    if (!isManagedAuthentikUser(authentikUser)) {
      return NextResponse.json(
        { error: "Dieses Konto wird direkt in Authentik verwaltet" },
        { status: 403 },
      );
    }
    const link = await createAuthentikLoginLink(authentikUser);
    await logger.info("Anmeldelink erzeugt (Admin)", {
      description: `${identity.email} durch ${session.user?.email ?? session.user?.id ?? "unbekannt"}`,
    });
    return NextResponse.json(
      { link, expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000).toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[authentik] Anmeldelink fehlgeschlagen", error);
    return NextResponse.json({ error: "Authentik ist gerade nicht erreichbar" }, { status: 502 });
  }
}
