import { AUTHENTIK_PROVIDER_ID } from "@/lib/authentik/config";
import { prisma } from "@/lib/prisma";

/**
 * Verknüpft ein Mitglied mit seinem Authentik-Konto (OIDC-"sub" = Authentik-UID).
 * Dieselbe Verknüpfung legt Auth.js beim ersten Authentik-Login an; sie ist
 * zugleich das Merkmal "Konto funktioniert in Authentik" für die Mitgliederliste.
 */
export async function linkAuthentikAccount(userId: string, authentikUid: string): Promise<void> {
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: AUTHENTIK_PROVIDER_ID,
        providerAccountId: authentikUid,
      },
    },
    create: {
      userId,
      type: "oidc",
      provider: AUTHENTIK_PROVIDER_ID,
      providerAccountId: authentikUid,
    },
    update: { userId },
  });
}

export async function hasAuthentikAccount(userId: string): Promise<boolean> {
  const count = await prisma.account.count({
    where: { userId, provider: AUTHENTIK_PROVIDER_ID },
  });
  return count > 0;
}
