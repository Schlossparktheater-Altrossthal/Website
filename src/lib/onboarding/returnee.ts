import { prisma } from "@/lib/prisma";
import { hashInviteToken, isInviteUsable } from "@/lib/member-invites";

export type ActiveInvite = { id: string; showId: string };

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
      expiresAt: true,
      maxUses: true,
      usageCount: true,
      isDisabled: true,
    },
  });
  if (!invite || !isInviteUsable(invite, now)) return null;
  return { id: invite.id, showId: invite.showId };
}

/**
 * Deaktivierte Mitglieder dürfen sich mit gültigem Einladungslink anmelden, bleiben aber
 * deaktiviert (kein Zugriff auf den Mitgliederbereich), bis sie das Rückkehrer-Onboarding
 * abgeschlossen haben.
 */
export function canSignInAsReturnee(
  member: { deactivatedAt: Date | null },
  invite: ActiveInvite | null,
): boolean {
  return !member.deactivatedAt || invite !== null;
}
