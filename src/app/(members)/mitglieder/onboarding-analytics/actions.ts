"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { calculateInviteStatus } from "@/lib/member-invites";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const renewSchema = z.object({
  profileId: z.string().min(1, "Profil-ID erforderlich"),
  extendDays: z.number().int().min(1).max(90).optional(),
});

export type RenewOnboardingInviteInput = z.infer<typeof renewSchema>;

export type RenewOnboardingInviteResult =
  | {
      success: true;
      invite: {
        id: string;
        expiresAt: string | null;
        isActive: boolean;
        isExpired: boolean;
        remainingUses: number | null;
      };
    }
  | {
      success: false;
      error:
        | "not_authorized"
        | "validation_failed"
        | "profile_not_found"
        | "missing_invite"
        | "missing_production"
        | "update_failed";
    };

const DEFAULT_EXTENSION_DAYS = 21;

export async function renewOnboardingInviteAction(
  input: RenewOnboardingInviteInput,
): Promise<RenewOnboardingInviteResult> {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.onboarding.analytics");
  if (!allowed) {
    return { success: false, error: "not_authorized" };
  }

  const parsed = renewSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "validation_failed" };
  }

  try {
    const profile = await prisma.memberOnboardingProfile.findUnique({
      where: { id: parsed.data.profileId },
      include: {
        invite: true,
        show: { select: { id: true } },
      },
    });

    if (!profile) {
      return { success: false, error: "profile_not_found" };
    }

    if (!profile.invite) {
      return { success: false, error: "missing_invite" };
    }

    if (!profile.showId) {
      return { success: false, error: "missing_production" };
    }

    const now = new Date();
    const extendDays = parsed.data.extendDays ?? DEFAULT_EXTENSION_DAYS;
    const currentExpiry = profile.invite.expiresAt ? new Date(profile.invite.expiresAt) : null;
    const baseDate = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + extendDays);

    const updatedInvite = await prisma.memberInvite.update({
      where: { id: profile.invite.id },
      data: {
        expiresAt: newExpiry,
        isDisabled: false,
      },
      select: {
        id: true,
        expiresAt: true,
        isDisabled: true,
        maxUses: true,
        usageCount: true,
      },
    });

    const status = calculateInviteStatus(updatedInvite, now);
    revalidatePath("/mitglieder/onboarding-analytics");

    return {
      success: true,
      invite: {
        id: updatedInvite.id,
        expiresAt: updatedInvite.expiresAt ? updatedInvite.expiresAt.toISOString() : null,
        isActive: status.isActive,
        isExpired: status.isExpired,
        remainingUses: status.remainingUses,
      },
    };
  } catch (error) {
    console.error("[onboarding-analytics] Failed to renew invite", error);
    return { success: false, error: "update_failed" };
  }
}
