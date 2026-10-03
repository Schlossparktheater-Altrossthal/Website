import { notFound } from "next/navigation";

import { ProfileClient } from "./profile-client";
import { PageHeader } from "@/components/members/page-header";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { getUserDisplayName } from "@/lib/names";
import { getOnboardingWhatsAppLink } from "@/lib/onboarding-settings";
import { getAvailableOnboardings } from "@/lib/onboarding/dashboard-service";
import { readStoredEducation, toEducationPayload } from "@/lib/education/schools";
import { prisma } from "@/lib/prisma";
import { buildProfileChecklist, isPaymentDetailsComplete } from "@/lib/profile-completion";
import { listCrewWishOptions } from "@/lib/onboarding/crew-options";
import { readProductionPreferences } from "@/lib/onboarding/production-preferences";
import { loadMemberHistory } from "@/lib/member-history";
import { isEnsembleMember } from "@/lib/measurements/access";
import { toSizeEntries } from "@/lib/measurements/members";
import type { MeasurementType, MeasurementUnit } from "@/data/measurements";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { sortRoles, type Role } from "@/lib/roles";
import { isPhotoConsentDone } from "@/lib/photo-consent-levels";
import { buildPhotoConsentSummary } from "@/lib/photo-consent-summary";
import {
  firstConsent,
  photoConsentsForShow,
  resolvePhotoConsentShowId,
} from "@/lib/photo-consent-scope";

const membersBreadcrumb = membersNavigationBreadcrumb("/mitglieder/profil");

export default async function ProfilePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.PROFILE.OWN.VIEW");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive-foreground">
          Kein Zugriff auf den Profilbereich
        </div>
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const photoConsentShowId = await resolvePhotoConsentShowId(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      createdAt: true,
      dateOfBirth: true,
      avatarSource: true,
      avatarImageUpdatedAt: true,
      role: true,
      roles: { select: { role: true } },
      appRoles: {
        select: {
          role: { select: { id: true, name: true, systemRole: true, isSystem: true } },
        },
      },
      payoutMethod: true,
      payoutAccountHolder: true,
      payoutIban: true,
      payoutBankName: true,
      payoutPaypalHandle: true,
      payoutNote: true,
      interests: {
        select: {
          interest: { select: { name: true } },
        },
      },
      onboardingProfile: {
        select: {
          focus: true,
          background: true,
          backgroundClass: true,
          educationCategory: true,
          educationSchoolName: true,
          educationClassName: true,
          educationWorkDescription: true,
          educationUniversityName: true,
          educationOtherDescription: true,
          notes: true,
          memberSinceYear: true,
          dietaryPreference: true,
          dietaryPreferenceVariant: true,
          dietaryPreferenceStrictness: true,
          whatsappLinkVisitedAt: true,
          updatedAt: true,
          show: { select: { id: true, meta: true, title: true, year: true } },
        },
      },
      photoConsents: photoConsentsForShow(photoConsentShowId, {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        rejectionReason: true,
        documentUploadedAt: true,
        documentName: true,
        documentMime: true,
        signatureCapturedAt: true,
        approvedBy: { select: { name: true } },
      }),
    },
  });

  if (!user) {
    notFound();
  }

  const [
    allergiesRaw,
    aversionsRaw,
    availableOnboardings,
    history,
    productionPreferences,
    activeShow,
    crewWishOptions,
  ] = await Promise.all([
    prisma.dietaryRestriction.findMany({
      where: { userId, isActive: true },
      orderBy: { allergen: "asc" },
      select: {
        id: true,
        allergen: true,
        kind: true,
        level: true,
        tracesOk: true,
        diagnosed: true,
        symptoms: true,
        treatment: true,
        note: true,
        updatedAt: true,
      },
    }),
    prisma.dietaryAversion.findMany({
      where: { userId, isActive: true },
      orderBy: { label: "asc" },
      select: { id: true, label: true, note: true, updatedAt: true },
    }),
    getAvailableOnboardings(),
    loadMemberHistory(userId, user.onboardingProfile?.memberSinceYear ?? null),
    readProductionPreferences(userId, photoConsentShowId),
    photoConsentShowId
      ? prisma.show.findUnique({
          where: { id: photoConsentShowId },
          select: {
            id: true,
            meta: true,
            title: true,
            year: true,
            productionOnboardings: {
              where: { userId },
              select: { notes: true, whatsappLinkVisitedAt: true, focus: true },
            },
          },
        })
      : null,
    listCrewWishOptions(photoConsentShowId),
  ]);

  const displayName = getUserDisplayName(
    {
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
    },
    "Unbekanntes Mitglied",
  );

  const roles = sortRoles([user.role as Role, ...user.roles.map((entry) => entry.role as Role)]);

  const preferenceSummaries = productionPreferences.preferences;
  const inherited = productionPreferences.inheritedFrom;
  const rolePreferencesInheritedFrom =
    inherited === "legacy"
      ? "deinen bisherigen Angaben"
      : inherited
        ? (inherited.title ?? `Produktion ${inherited.year}`)
        : null;

  const customRoles = user.appRoles
    .map((entry) => entry.role)
    .filter(
      (role): role is { id: string; name: string; systemRole: Role | null; isSystem: boolean } =>
        Boolean(role),
    )
    .filter((role) => !role.systemRole)
    .map((role) => ({ id: role.id, name: role.name }));

  const interestNames = Array.from(
    new Set(
      user.interests
        .map((entry) => entry.interest?.name?.trim() ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const currentPhotoConsent = firstConsent(user.photoConsents);
  const photoConsentSummary = buildPhotoConsentSummary({
    dateOfBirth: user.dateOfBirth,
    photoConsent: currentPhotoConsent
      ? {
          id: currentPhotoConsent.id,
          status: currentPhotoConsent.status,
          createdAt: currentPhotoConsent.createdAt,
          updatedAt: currentPhotoConsent.updatedAt,
          approvedAt: currentPhotoConsent.approvedAt,
          rejectionReason: currentPhotoConsent.rejectionReason,
          documentUploadedAt: currentPhotoConsent.documentUploadedAt,
          documentName: currentPhotoConsent.documentName,
          documentMime: currentPhotoConsent.documentMime,
          approvedByName: currentPhotoConsent.approvedBy?.name ?? null,
        }
      : null,
  });

  const allergies = allergiesRaw.map((allergy) => ({
    id: allergy.id,
    allergen: allergy.allergen,
    kind: allergy.kind,
    level: allergy.level,
    tracesOk: allergy.tracesOk,
    diagnosed: allergy.diagnosed,
    symptoms: allergy.symptoms ?? null,
    treatment: allergy.treatment ?? null,
    note: allergy.note ?? null,
    updatedAt: allergy.updatedAt?.toISOString() ?? null,
  }));

  const aversions = aversionsRaw.map((aversion) => ({
    id: aversion.id,
    label: aversion.label,
    note: aversion.note ?? null,
    updatedAt: aversion.updatedAt?.toISOString() ?? null,
  }));

  const hasBasicData = Boolean(user.firstName?.trim() && user.email?.trim());
  const hasBirthdate = Boolean(user.dateOfBirth);
  const hasDietaryPreference = Boolean(user.onboardingProfile?.dietaryPreference?.trim());
  const hasPaymentDetails = isPaymentDetailsComplete({
    payoutMethod: user.payoutMethod,
    payoutAccountHolder: user.payoutAccountHolder,
    payoutIban: user.payoutIban,
    payoutBankName: user.payoutBankName,
    payoutPaypalHandle: user.payoutPaypalHandle,
    payoutNote: user.payoutNote,
  });

  // „Meine Produktion“ bezieht sich immer auf die aktive Produktion (Umschalter in der Seitenleiste).
  const onboardingProfile = user.onboardingProfile;
  const productionOnboarding = activeShow?.productionOnboardings[0] ?? null;
  const profileMatchesShow = Boolean(activeShow && onboardingProfile?.show?.id === activeShow.id);
  const whatsappLink = activeShow ? getOnboardingWhatsAppLink(activeShow.meta) : null;
  const onboardingSummary = activeShow
    ? availableOnboardings.find((entry) => entry.id === activeShow.id)
    : null;
  const productionNotes =
    productionOnboarding?.notes ?? (profileMatchesShow ? onboardingProfile?.notes : null) ?? null;
  const whatsappVisitedAt =
    productionOnboarding?.whatsappLinkVisitedAt ??
    (profileMatchesShow ? onboardingProfile?.whatsappLinkVisitedAt : null) ??
    null;

  const checklist = buildProfileChecklist({
    hasBasicData,
    hasBirthdate,
    hasPaymentDetails,
    hasDietaryPreference,
    photoConsent: {
      confirmed: isPhotoConsentDone({
        status: photoConsentSummary.status,
        hasProof: Boolean(
          currentPhotoConsent?.documentUploadedAt || currentPhotoConsent?.signatureCapturedAt,
        ),
      }),
    },
  });

  const onboarding =
    onboardingProfile || activeShow
      ? {
          focus: productionOnboarding?.focus ?? onboardingProfile?.focus ?? "acting",
          background: onboardingProfile?.background ?? null,
          backgroundClass: onboardingProfile?.backgroundClass ?? null,
          education: toEducationPayload(readStoredEducation(onboardingProfile)),
          notes: productionNotes,
          memberSinceYear: onboardingProfile?.memberSinceYear ?? null,
          dietaryPreference: onboardingProfile?.dietaryPreference ?? null,
          dietaryPreferenceVariant: onboardingProfile?.dietaryPreferenceVariant ?? null,
          dietaryPreferenceStrictness: onboardingProfile?.dietaryPreferenceStrictness ?? null,
          whatsappLinkVisitedAt: whatsappVisitedAt?.toISOString() ?? null,
          updatedAt: onboardingProfile?.updatedAt?.toISOString() ?? null,
          preferences: preferenceSummaries,
          show: activeShow
            ? {
                id: activeShow.id,
                title: activeShow.title ?? null,
                year: activeShow.year,
                periodLabel: onboardingSummary?.periodLabel ?? null,
                status: onboardingSummary?.status ?? "draft",
              }
            : null,
          whatsappLink,
        }
      : null;

  // Körpermaße nur fürs Ensemble (Systemrolle „cast“ oder in einer Rolle besetzt).
  const isEnsemble = await isEnsembleMember(userId);
  const sizes = isEnsemble
    ? toSizeEntries(
        await prisma.memberSize.findMany({
          where: { userId },
          select: { id: true, category: true, size: true, note: true },
        }),
      )
    : [];
  const measurements = isEnsemble
    ? (
        await prisma.memberMeasurement.findMany({
          where: { userId },
          select: { id: true, type: true, value: true, unit: true, note: true, updatedAt: true },
        })
      ).map((entry) => ({
        id: entry.id,
        type: entry.type as MeasurementType,
        value: entry.value,
        unit: entry.unit as MeasurementUnit,
        note: entry.note,
        updatedAt: entry.updatedAt.toISOString(),
      }))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Mein Profil" breadcrumbs={[membersBreadcrumb]} />
      <ProfileClient
        history={history}
        measurements={measurements}
        sizes={sizes}
        user={{
          id: user.id,
          email: user.email ?? "",
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          displayName,
          createdAt: user.createdAt.toISOString(),
          dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
          avatarSource: user.avatarSource,
          avatarUpdatedAt: user.avatarImageUpdatedAt?.toISOString() ?? null,
          roles,
          customRoles,
          payoutMethod: user.payoutMethod,
          payoutAccountHolder: user.payoutAccountHolder ?? null,
          payoutIban: user.payoutIban ?? null,
          payoutBankName: user.payoutBankName ?? null,
          payoutPaypalHandle: user.payoutPaypalHandle ?? null,
          payoutNote: user.payoutNote ?? null,
        }}
        onboarding={onboarding}
        rolePreferences={preferenceSummaries}
        interests={interestNames}
        allergies={allergies}
        aversions={aversions}
        checklist={checklist}
        rolePreferencesInheritedFrom={rolePreferencesInheritedFrom}
        crewWishOptions={crewWishOptions}
      />
    </div>
  );
}
