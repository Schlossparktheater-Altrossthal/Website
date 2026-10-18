import {
  findAuthentikUserByUid,
  findAuthentikUserForMember,
  type AuthentikUser,
} from "@/lib/authentik/client";
import { AUTHENTIK_PROVIDER_ID } from "@/lib/authentik/config";
import { memberIdentitySelect, toMemberIdentity } from "@/lib/authentik/sync";
import { prisma } from "@/lib/prisma";

/**
 * Authentik-Konto eines Mitglieds, ohne es anzulegen: zuerst das Konto, mit
 * dem es sich tatsächlich anmeldet (verknüpfter Login, z. B. ein Admin-Konto
 * mit anderer E-Mail), sonst über Profil-ID bzw. E-Mail. Grundlage für "Anmeldung & Sicherheit" im Profil und die
 * Anmelde-Karte in der Mitgliederverwaltung.
 */
export async function findAuthentikUserForMemberId(userId: string): Promise<AuthentikUser | null> {
  const linked = await prisma.account.findFirst({
    where: { userId, provider: AUTHENTIK_PROVIDER_ID },
    select: { providerAccountId: true },
  });
  if (linked) {
    const loginUser = await findAuthentikUserByUid(linked.providerAccountId);
    if (loginUser) return loginUser;
  }
  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: memberIdentitySelect,
  });
  const identity = member ? toMemberIdentity(member) : null;
  return identity ? findAuthentikUserForMember(identity) : null;
}
