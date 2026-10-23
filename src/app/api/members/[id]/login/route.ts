import { requireApiSession, withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AUTHENTIK_DEVICE_KINDS,
  clearAuthentikLoginLink,
  deleteAuthentikDevice,
  isManagedAuthentikUser,
  listAuthentikDevices,
  sendAuthentikPasswordEmail,
} from "@/lib/authentik/client";
import { isAuthentikProvisioningEnabled } from "@/lib/authentik/config";
import { findAuthentikUserForMemberId } from "@/lib/authentik/devices";
import {
  ensureAuthentikUserForMember,
  memberIdentitySelect,
  toMemberIdentity,
} from "@/lib/authentik/sync";
import { createLogger } from "@/lib/logger";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const logger = createLogger("authentik-member-login");

async function authorize() {
  const session = await requireApiSession();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) {
    return { error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) };
  }
  if (!isAuthentikProvisioningEnabled()) {
    return {
      error: NextResponse.json(
        { error: "Theater-Konten sind hier nicht verwaltbar" },
        { status: 503 },
      ),
    };
  }
  return { actor: session.user?.email ?? session.user?.id ?? "unbekannt" };
}

function authentikError(error: unknown, message: string) {
  console.error(`[authentik] ${message}`, error);
  return NextResponse.json({ error: "Authentik ist gerade nicht erreichbar" }, { status: 502 });
}

/**
 * Anmeldung eines Mitglieds für die Mitgliederverwaltung: Theater-Konto,
 * Passwort-Stand, Passkeys und Authenticator-Apps (aus Authentik).
 */
export const GET = withRoute<{ id: string }>(
  { name: "members/[id]/login.get", permission: "PRIVATE.ADMIN.MEMBERS.MANAGE" },
  async ({ params }) => {
    if (!isAuthentikProvisioningEnabled()) return NextResponse.json({ available: false });

    const { id } = params;
    try {
      const authentikUser = await findAuthentikUserForMemberId(id);
      if (!authentikUser) return NextResponse.json({ available: true, account: null, devices: [] });
      return NextResponse.json({
        available: true,
        account: {
          username: authentikUser.username,
          active: authentikUser.is_active,
          managed: isManagedAuthentikUser(authentikUser),
          passwordChangedAt: authentikUser.password_change_date,
        },
        devices: await listAuthentikDevices(authentikUser),
      });
    } catch (error) {
      return authentikError(error, "Anmeldedaten konnten nicht geladen werden");
    }
  },
);

const deleteSchema = z.object({
  kind: z.enum(AUTHENTIK_DEVICE_KINDS),
  /** Ohne ID: alle Geräte dieser Art (z. B. Zwei-Faktor zurücksetzen). */
  id: z.string().min(1).max(100).optional(),
});

/** Passkey/Authenticator-App entfernen oder alle einer Art zurücksetzen. */
export const DELETE = withRoute<{ id: string }>(
  { name: "members/[id]/login.delete" },
  async ({ request, params }) => {
    const auth = await authorize();
    if (auth.error) return auth.error;
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

    const { id } = params;
    try {
      const authentikUser = await findAuthentikUserForMemberId(id);
      if (!authentikUser || !isManagedAuthentikUser(authentikUser)) {
        return NextResponse.json(
          { error: "Dieses Konto wird direkt in Authentik verwaltet" },
          { status: 403 },
        );
      }
      const { kind } = parsed.data;
      const ids = parsed.data.id
        ? [parsed.data.id]
        : (await listAuthentikDevices(authentikUser))
            .filter((device) => device.kind === kind)
            .map((device) => device.id);
      let removed = 0;
      for (const deviceId of ids) {
        if (await deleteAuthentikDevice(authentikUser, kind, deviceId)) removed += 1;
      }
      if (parsed.data.id && removed === 0) {
        return NextResponse.json({ error: "Gerät nicht gefunden" }, { status: 404 });
      }
      await logger.info(
        kind === "totp" ? "Authenticator-App entfernt (Admin)" : "Passkey entfernt (Admin)",
        { description: `${authentikUser.username}: ${removed} durch ${auth.actor}` },
      );
      return NextResponse.json({ ok: true, removed });
    } catch (error) {
      return authentikError(error, "Gerät konnte nicht entfernt werden");
    }
  },
);

/** Mail "Passwort festlegen" schicken (legt das Theater-Konto bei Bedarf an). */
export const POST = withRoute<{ id: string }>(
  { name: "members/[id]/login.post" },
  async ({ params }) => {
    const auth = await authorize();
    if (auth.error) return auth.error;

    const { id } = params;
    const member = await prisma.user.findUnique({ where: { id }, select: memberIdentitySelect });
    const identity = member ? toMemberIdentity(member) : null;
    if (!identity) {
      return NextResponse.json({ error: "Mitglied hat keine E-Mail-Adresse" }, { status: 400 });
    }
    try {
      const { user: authentikUser } = await ensureAuthentikUserForMember(identity);
      // Ein früherer Anmeldelink hat das Konto auf „Passkey statt Passwort“ gestellt.
      await clearAuthentikLoginLink(authentikUser);
      await sendAuthentikPasswordEmail(authentikUser);
      // ÜBERGANGSPHASE: wie bei "Passwort vergessen" den alten lokalen Hash
      // verwerfen, sonst überschreibt das alte Formular das neue Passwort.
      await prisma.user.update({ where: { id }, data: { passwordHash: null } });
      await logger.info("Passwort-Mail verschickt (Admin)", {
        description: `${identity.email} durch ${auth.actor}`,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return authentikError(error, "Passwort-Mail fehlgeschlagen");
    }
  },
);
