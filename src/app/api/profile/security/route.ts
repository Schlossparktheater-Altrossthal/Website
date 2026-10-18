import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AUTHENTIK_DEVICE_KINDS,
  deleteAuthentikDevice,
  hasAuthentikPasswordSinceCreation,
  isManagedAuthentikUser,
  listAuthentikDevices,
  type AuthentikDevice,
} from "@/lib/authentik/client";
import { getAuthentikAccountLinks, isAuthentikProvisioningEnabled } from "@/lib/authentik/config";
import { findAuthentikUserForMemberId as loadAuthentikUser } from "@/lib/authentik/devices";
import { requireAuth } from "@/lib/rbac";

/**
 * Profil "Anmeldung & Sicherheit": Links in die Konto-Flows von Authentik und
 * die hinterlegten Passkeys/Authenticator-Apps. Ohne API-Token (Staging) gibt
 * es nur die Links, die Geräte zeigt dann Authentik selbst.
 */
export async function GET() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const links = getAuthentikAccountLinks();
  if (!links) return NextResponse.json({ mode: "local" });

  let devices: AuthentikDevice[] | null = null;
  // Authentik war gefragt, hat aber nicht (rechtzeitig) geantwortet.
  let devicesError = false;
  let canManage = false;
  // `null`: unbekannt (ohne API-Token) – dann heißt der Knopf „Passwort ändern“.
  let hasPassword: boolean | null = null;
  if (isAuthentikProvisioningEnabled()) {
    try {
      const authentikUser = await loadAuthentikUser(userId);
      if (authentikUser) {
        devices = await listAuthentikDevices(authentikUser);
        canManage = isManagedAuthentikUser(authentikUser);
        hasPassword = hasAuthentikPasswordSinceCreation(authentikUser);
      } else {
        devices = [];
      }
    } catch (error) {
      console.error("[authentik] Geräte konnten nicht geladen werden", error);
      devicesError = true;
    }
  }

  return NextResponse.json({
    mode: "authentik",
    links,
    devices,
    devicesError,
    canManage,
    hasPassword,
  });
}

const deleteSchema = z.object({
  kind: z.enum(AUTHENTIK_DEVICE_KINDS),
  id: z.string().min(1).max(100),
});

/** Passkey oder Authenticator-App des eigenen Kontos entfernen. */
export async function DELETE(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!isAuthentikProvisioningEnabled()) {
    return NextResponse.json({ error: "Hier nicht verfügbar" }, { status: 503 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  try {
    const authentikUser = await loadAuthentikUser(userId);
    if (!authentikUser || !isManagedAuthentikUser(authentikUser)) {
      return NextResponse.json({ error: "Konto wird in Authentik verwaltet" }, { status: 403 });
    }
    const removed = await deleteAuthentikDevice(authentikUser, parsed.data.kind, parsed.data.id);
    if (!removed) return NextResponse.json({ error: "Gerät nicht gefunden" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[authentik] Gerät konnte nicht entfernt werden", error);
    return NextResponse.json({ error: "Authentik nicht erreichbar" }, { status: 502 });
  }
}
