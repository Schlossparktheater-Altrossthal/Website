import { notFound } from "next/navigation";

import { ProfileClient } from "./profile-client";
import { PageHeader } from "@/components/members/page-header";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { getUserDisplayName } from "@/lib/names";
import { getOnboardingWhatsAppLink } from "@/lib/onboarding-settings";
import { prisma } from "@/lib/prisma";
import { buildProfileChecklist } from "@/lib/profile-completion";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { sortRoles, type Role } from "@/lib/roles";
import { buildPhotoConsentSummary } from "@/lib/photo-consent-summary";

const membersBreadcrumb = membersNavigationBreadcrumb("/mitglieder/profil");

export default async function ProfilePage() {
  const session = await requireAuth();
  const [allowed, canManageMeasurements] = await Promise.all([
    hasPermission(session.user, "mitglieder.profil"),
    hasPermission(session.user, "mitglieder.koerpermasse"),
  ]);

  if (!allowed) {
    return (
      <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-destructive">
        Kein Zugriff auf den Profilbereich
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

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
          notes: true,
          memberSinceYear: true,
          dietaryPreference: true,
          dietaryPreferenceStrictness: true,
          whatsappLinkVisitedAt: true,
          updatedAt: true,
          show: { select: { meta: true, title: true, year: true } },
        },
      },
      photoConsent: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          approvedAt: true,
          rejectionReason: true,
          documentUploadedAt: true,
          documentName: true,
          documentMime: true,
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const [allergiesRaw, measurementsRaw] = await Promise.all([
    prisma.dietaryRestriction.findMany({
      where: { userId, isActive: true },
      orderBy: { allergen: "asc" },
      select: {
        id: true,
        allergen: true,
        level: true,
        symptoms: true,
        treatment: true,
        note: true,
        updatedAt: true,
      },
    }),
    canManageMeasurements
      ? prisma.memberMeasurement.findMany({
          where: { userId },
          orderBy: { type: "asc" },
          select: {
            id: true,
            type: true,
            value: true,
            unit: true,
            note: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
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

  const roles = sortRoles([
    user.role as Role,
    ...user.roles.map((entry) => entry.role as Role),
  ]);

  const customRoles = user.appRoles
    .map((entry) => entry.role)
    .filter((role): role is { id: string; name: string; systemRole: Role | null; isSystem: boolean } => Boolean(role))
    .filter((role) => !role.systemRole)
    .map((role) => ({ id: role.id, name: role.name }));

  const interestNames = Array.from(
    new Set(
      user.interests
        .map((entry) => entry.interest?.name?.trim() ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const photoConsentSummary = buildPhotoConsentSummary({
    dateOfBirth: user.dateOfBirth,
    photoConsent: user.photoConsent
      ? {
          id: user.photoConsent.id,
          status: user.photoConsent.status,
          createdAt: user.photoConsent.createdAt,
          updatedAt: user.photoConsent.updatedAt,
          approvedAt: user.photoConsent.approvedAt,
          rejectionReason: user.photoConsent.rejectionReason,
          documentUploadedAt: user.photoConsent.documentUploadedAt,
          documentName: user.photoConsent.documentName,
          documentMime: user.photoConsent.documentMime,
          approvedByName: user.photoConsent.approvedBy?.name ?? null,
        }
      : null,
  });

  const measurementSummaries = measurementsRaw.map((measurement) => ({
    id: measurement.id,
    type: measurement.type,
    value: measurement.value,
    unit: measurement.unit,
    note: measurement.note ?? null,
    updatedAt: measurement.updatedAt?.toISOString() ?? null,
  }));

  const allergies = allergiesRaw.map((allergy) => ({
    id: allergy.id,
    allergen: allergy.allergen,
    level: allergy.level,
    symptoms: allergy.symptoms ?? null,
    treatment: allergy.treatment ?? null,
    note: allergy.note ?? null,
    updatedAt: allergy.updatedAt?.toISOString() ?? null,
  }));

  const hasMeasurements = canManageMeasurements ? measurementSummaries.length > 0 : undefined;
  const hasBasicData = Boolean(user.firstName?.trim() && user.email?.trim());
  const hasBirthdate = Boolean(user.dateOfBirth);
  const hasDietaryPreference = Boolean(user.onboardingProfile?.dietaryPreference?.trim());

  const checklist = buildProfileChecklist({
    hasBasicData,
    hasBirthdate,
    hasDietaryPreference,
    hasMeasurements,
    photoConsent: { consentGiven: photoConsentSummary.status === "approved" },
  });

  const onboardingProfile = user.onboardingProfile;
  const whatsappLink = onboardingProfile?.show
    ? getOnboardingWhatsAppLink(onboardingProfile.show.meta)
    : null;

  const onboarding = onboardingProfile
    ? {
        focus: onboardingProfile.focus,
        background: onboardingProfile.background ?? null,
        backgroundClass: onboardingProfile.backgroundClass ?? null,
        notes: onboardingProfile.notes ?? null,
        memberSinceYear: onboardingProfile.memberSinceYear ?? null,
        dietaryPreference: onboardingProfile.dietaryPreference ?? null,
        dietaryPreferenceStrictness: onboardingProfile.dietaryPreferenceStrictness ?? null,
        whatsappLinkVisitedAt: onboardingProfile.whatsappLinkVisitedAt?.toISOString() ?? null,
        updatedAt: onboardingProfile.updatedAt?.toISOString() ?? null,
        show: onboardingProfile.show
          ? {
              title: onboardingProfile.show.title ?? null,
              year: onboardingProfile.show.year,
            }
          : null,
      }
    : null;

  const headerDescription = "Pflege deine Stammdaten, Ernährungspräferenzen und Freigaben für unser Ensemble.";

  return (
    <div className="space-y-8">
      <PageHeader title="Mein Profil" description={headerDescription} breadcrumbs={[membersBreadcrumb]} />
      <ProfileClient
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
        }}
        onboarding={onboarding}
        interests={interestNames}
        allergies={allergies}
        measurements={measurementSummaries}
        canManageMeasurements={canManageMeasurements}
        checklist={checklist}
        whatsappLink={whatsappLink}
      />
    </div>
  );
}
