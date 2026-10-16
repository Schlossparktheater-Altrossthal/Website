import { findAuthentikUserForMember, type AuthentikUser } from "@/lib/authentik/client";
import { memberIdentitySelect, toMemberIdentity } from "@/lib/authentik/sync";
import { prisma } from "@/lib/prisma";

/**
 * Authentik-Konto eines Mitglieds (über Profil-ID, sonst E-Mail), ohne es
 * anzulegen. Grundlage für "Anmeldung & Sicherheit" im Profil und die
 * Anmelde-Karte in der Mitgliederverwaltung.
 */
export async function findAuthentikUserForMemberId(userId: string): Promise<AuthentikUser | null> {
  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: memberIdentitySelect,
  });
  const identity = member ? toMemberIdentity(member) : null;
  return identity ? findAuthentikUserForMember(identity) : null;
}
