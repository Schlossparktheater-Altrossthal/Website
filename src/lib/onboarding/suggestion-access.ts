import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { hashInviteToken, isInviteUsable } from "@/lib/member-invites";
import { prisma } from "@/lib/prisma";

/**
 * Zugriff auf Onboarding-Vorschläge: angemeldet oder mit gültigem Onboarding-Link
 * (`?token=`, Klartext oder Hash) – neue Mitglieder haben im Wizard noch kein Konto.
 */
export async function hasOnboardingSuggestionAccess(request: NextRequest): Promise<boolean> {
  const session = await auth();
  if (session?.user?.id) return true;
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return false;
  const tokenHash = /^[0-9a-f]{64}$/i.test(token) ? token.toLowerCase() : hashInviteToken(token);
  const invite = await prisma.memberInvite.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, maxUses: true, usageCount: true, isDisabled: true },
  });
  return Boolean(invite && isInviteUsable(invite));
}
