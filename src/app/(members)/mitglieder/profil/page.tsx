import { notFound } from "next/navigation";
import type {
  AllergyLevel,
  MeasurementType,
  MeasurementUnit,
  Role,
} from "@prisma/client";

import { ProfilePageClient } from "@/components/members/profile-page-client";
import { prisma } from "@/lib/prisma";
import { hasRole, requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { sortRoles } from "@/lib/roles";
import { buildPhotoConsentSummary } from "@/lib/photo-consent-summary";
import { buildProfileChecklist } from "@/lib/profile-completion";
import {
  DEFAULT_STRICTNESS_FOR_NONE,
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
  type DietaryStrictnessOption,
} from "@/data/dietary-preferences";

export default async function ProfilePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.profil");

  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf den Profilbereich</div>;
  }

  const userId = session.user?.id;

  if (!userId) {
    notFound();
  }

  const hasMeasurementPermission = await hasPermission(
    session.user,
    "mitglieder.koerpermasse",
  );
  const isEnsembleMember = hasRole(session.user, "cast");
  const canManageMeasurements = hasMeasurementPermission && isEnsembleMember;

  const [user, measurementRecords, allergyRecords] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        role: true,
        roles: { select: { role: true } },
        avatarSource: true,
        avatarImageUpdatedAt: true,
        dateOfBirth: true,
        onboardingProfile: {
          select: {
            dietaryPreference: true,
            dietaryPreferenceStrictness: true,
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
    }),
    canManageMeasurements
      ? prisma.memberMeasurement.findMany({
          where: { userId },
          orderBy: { type: "asc" },
        })
      : Promise.resolve([]),
    prisma.dietaryRestriction.findMany({
      where: { userId, isActive: true },
      orderBy: { allergen: "asc" },
      select: {
        allergen: true,
        level: true,
        symptoms: true,
        treatment: true,
        note: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!user) {
    notFound();
  }

  const roles = sortRoles([
    user.role as Role,
    ...user.roles.map((role) => role.role as Role),
  ]);

  const measurements = canManageMeasurements
    ? measurementRecords.map((entry) => ({
        id: entry.id,
        type: entry.type as MeasurementType,
        value: entry.value,
        unit: entry.unit as MeasurementUnit,
        note: entry.note,
        updatedAt: entry.updatedAt.toISOString(),
      }))
    : [];

  const allergies = allergyRecords.map((entry) => ({
    allergen: entry.allergen,
    level: entry.level as AllergyLevel,
    symptoms: entry.symptoms,
    treatment: entry.treatment,
    note: entry.note,
    updatedAt: entry.updatedAt.toISOString(),
  }));

  const styleInfo = parseDietaryStyleFromLabel(
    user.onboardingProfile?.dietaryPreference ?? null,
  );
  const strictnessValue = parseDietaryStrictnessFromLabel(
    user.onboardingProfile?.dietaryPreferenceStrictness ?? null,
  );
  const normalizedStrictness: DietaryStrictnessOption =
    styleInfo.style === "none" || styleInfo.style === "omnivore"
      ? DEFAULT_STRICTNESS_FOR_NONE
      : strictnessValue;

  const photoSummary = buildPhotoConsentSummary({
    dateOfBirth: user.dateOfBirth,
    photoConsent: user.photoConsent
      ? {
          id: user.photoConsent.id,
          status: user.photoConsent.status,
          createdAt: user.photoConsent.createdAt ?? undefined,
          updatedAt: user.photoConsent.updatedAt ?? undefined,
          approvedAt: user.photoConsent.approvedAt ?? undefined,
          rejectionReason: user.photoConsent.rejectionReason ?? null,
          documentUploadedAt: user.photoConsent.documentUploadedAt ?? null,
          documentName: user.photoConsent.documentName ?? null,
          documentMime: user.photoConsent.documentMime ?? null,
          approvedByName: user.photoConsent.approvedBy?.name ?? null,
        }
      : null,
  });

  const checklist = buildProfileChecklist({
    hasBasicData: Boolean(user.firstName && user.lastName && user.email),
    hasBirthdate: Boolean(user.dateOfBirth),
    hasDietaryPreference: Boolean(
      user.onboardingProfile?.dietaryPreference?.trim(),
    ),
    hasMeasurements: canManageMeasurements ? measurements.length > 0 : undefined,
    photoConsent: {
      consentGiven:
        photoSummary.status === "pending" || photoSummary.status === "approved",
    },
  });

  return (
    <ProfilePageClient
      user={{
        id: userId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email ?? null,
        roles,
        avatarSource: user.avatarSource ?? null,
        avatarUpdatedAt: user.avatarImageUpdatedAt?.toISOString() ?? null,
        dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
      }}
      checklist={checklist.items}
      canManageMeasurements={canManageMeasurements}
      measurements={canManageMeasurements ? measurements : undefined}
      dietaryPreference={{
        style: styleInfo.style,
        customLabel: styleInfo.customLabel,
        strictness: normalizedStrictness,
      }}
      allergies={allergies}
      photoConsent={photoSummary}
    />
  );
}
