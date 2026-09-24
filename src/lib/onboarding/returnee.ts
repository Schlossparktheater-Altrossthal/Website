import { prisma } from "@/lib/prisma";
import { hashInviteToken, isInviteUsable } from "@/lib/member-invites";

export type ActiveInvite = { id: string; showId: string; personalForUserId: string | null };

/** Nimmt den Klartext-Token oder dessen Hash aus einem Einladungslink entgegen. */
export function normalizeInviteTokenHash(token: string): string {
  const trimmed = token.trim();
  return /^[0-9a-f]{64}$/i.test(trimmed) ? trimmed.toLowerCase() : hashInviteToken(trimmed);
}

/** Liefert die Einladung zu einem Token, wenn sie noch benutzbar ist. */
export async function resolveActiveInvite(
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<ActiveInvite | null> {
  if (!token || !token.trim()) return null;
  const invite = await prisma.memberInvite.findUnique({
    where: { tokenHash: normalizeInviteTokenHash(token) },
    select: {
      id: true,
      showId: true,
      personalForUserId: true,
      expiresAt: true,
      maxUses: true,
      usageCount: true,
      isDisabled: true,
    },
  });
  if (!invite || !isInviteUsable(invite, now)) return null;
  return { id: invite.id, showId: invite.showId, personalForUserId: invite.personalForUserId };
}

/**
 * Deaktivierte Mitglieder dürfen sich mit gültigem Einladungslink anmelden, bleiben aber
 * deaktiviert (kein Zugriff auf den Mitgliederbereich), bis sie das Rückkehrer-Onboarding
 * abgeschlossen haben.
 */
export function canSignInAsReturnee(
  member: { id: string; deactivatedAt: Date | null },
  invite: ActiveInvite | null,
): boolean {
  if (!member.deactivatedAt) return true;
  return invite !== null && isInviteForMember(invite, member.id);
}

/** Persönliche Einladungen gelten nur für das Konto, für das sie erstellt wurden. */
export function isInviteForMember(
  invite: { personalForUserId: string | null },
  userId: string,
): boolean {
  return invite.personalForUserId === null || invite.personalForUserId === userId;
}
