/**
 * Abgleich Mitgliederbereich -> Authentik. Der Mitgliederbereich ist Quelle
 * der Wahrheit für E-Mail und Name; Mitglieder können beides in Authentik
 * nicht selbst ändern (der Theater-Brand hat bewusst keinen Einstellungs-Flow).
 *
 * Deaktivierte Profile (z. B. nach dem Jahreswechsel) bleiben in Authentik
 * aktiv: Rückkehrer müssen sich über den Onboarding-Link wieder anmelden
 * können, und der Mitgliederbereich weist deaktivierte Profile selbst ab.
 * Nur gelöschte Profile werden in Authentik deaktiviert.
 */
import {
  deactivateAuthentikUser,
  ensureAuthentikUser,
  findAuthentikUserByMemberId,
  reconcileAuthentikUser,
  type MemberIdentity,
} from "@/lib/authentik/client";
import { isAuthentikProvisioningEnabled } from "@/lib/authentik/config";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import { createLogger } from "@/lib/logger";
import { combineNameParts } from "@/lib/names";
import { prisma } from "@/lib/prisma";

const logger = createLogger("authentik-sync");

type MemberRecord = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
};

export const memberIdentitySelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  name: true,
} as const;

export function toMemberIdentity(member: MemberRecord): MemberIdentity | null {
  if (!member.email) return null;
  return {
    userId: member.id,
    email: member.email,
    name: combineNameParts(member.firstName, member.lastName) ?? member.name,
  };
}

async function isKnownMember(userId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { id: userId } });
  return count > 0;
}

/**
 * Wie `ensureAuthentikUser`, übernimmt aber Konten verwaister Profile. Neue
 * Konten bekommen danach ihre Dienst-Gruppen (z. B. Nextcloud).
 */
export async function ensureAuthentikUserForMember(identity: MemberIdentity) {
  const result = await ensureAuthentikUser(identity, { isKnownMember });
  requestServiceGroupSync();
  return result;
}

async function logSyncError(message: string, userId: string, error: unknown) {
  console.error(`[authentik] ${message}`, error);
  await logger.error(message, {
    description: userId,
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Überträgt E-Mail und Name eines Mitglieds in sein Authentik-Konto (falls es
 * schon eines gibt). Fehler werden geloggt, nicht geworfen.
 */
export async function syncMemberToAuthentik(userId: string): Promise<void> {
  if (!isAuthentikProvisioningEnabled()) return;
  try {
    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: memberIdentitySelect,
    });
    const identity = member ? toMemberIdentity(member) : null;
    if (!identity) return;
    const authentikUser = await findAuthentikUserByMemberId(userId);
    if (!authentikUser) return;
    await reconcileAuthentikUser(authentikUser, identity);
  } catch (error) {
    await logSyncError("Abgleich mit Authentik fehlgeschlagen", userId, error);
  }
}

/** Vor dem Löschen eines Profils: Authentik-Konto deaktivieren. */
export async function deactivateMemberInAuthentik(userId: string): Promise<void> {
  if (!isAuthentikProvisioningEnabled()) return;
  try {
    const authentikUser = await findAuthentikUserByMemberId(userId);
    if (authentikUser) await deactivateAuthentikUser(authentikUser);
    requestServiceGroupSync();
  } catch (error) {
    await logSyncError("Deaktivieren in Authentik fehlgeschlagen", userId, error);
  }
}
