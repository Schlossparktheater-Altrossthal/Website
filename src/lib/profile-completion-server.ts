import { firstConsent, photoConsentsForShow } from "@/lib/photo-consent-scope";
import { prisma } from "@/lib/prisma";
import {
  buildProfileChecklist,
  isPaymentDetailsComplete,
  type ProfileCompletionSummary,
} from "@/lib/profile-completion";

/**
 * Profil-Checkliste für Dashboard und andere Übersichten. Nutzt dieselben Regeln wie die
 * Profilseite, damit beide denselben Stand anzeigen.
 */
export async function loadProfileChecklist(
  userId: string,
  photoConsentShowId: string | null,
): Promise<ProfileCompletionSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      email: true,
      dateOfBirth: true,
      payoutMethod: true,
      payoutAccountHolder: true,
      payoutIban: true,
      payoutBankName: true,
      payoutPaypalHandle: true,
      payoutNote: true,
      onboardingProfile: { select: { dietaryPreference: true } },
      photoConsents: photoConsentsForShow(photoConsentShowId, { status: true }),
    },
  });
  if (!user) return null;

  return buildProfileChecklist({
    hasBasicData: Boolean(user.firstName?.trim() && user.email?.trim()),
    hasBirthdate: Boolean(user.dateOfBirth),
    hasPaymentDetails: isPaymentDetailsComplete(user),
    hasDietaryPreference: Boolean(user.onboardingProfile?.dietaryPreference?.trim()),
    photoConsent: { consentGiven: firstConsent(user.photoConsents)?.status === "approved" },
  });
}
