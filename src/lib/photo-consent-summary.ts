import type { PhotoConsentPurposeAudience } from "@prisma/client";

import {
  purposeAppliesToAudience,
  resolvePhotoConsentAudience,
} from "@/lib/photo-consent-purposes";
import type {
  PhotoConsentPurposeSnapshot,
  PhotoConsentPurposeView,
  PhotoConsentSummary,
  PhotoConsentVersionView,
} from "@/types/photo-consent";
import { signaturePayloadSchema, type SignaturePayload } from "@/types/signature";

/** Status, wie er in der Datenbank steht (ohne das abgeleitete „none“). */
export type PersistedPhotoConsentStatus = "pending" | "approved" | "rejected" | "noPhotos";

type ConsentRecord = {
  id?: string;
  status: PersistedPhotoConsentStatus | "none";
  revokedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  exclusionNote?: string | null;
  documentUploadedAt?: Date | null;
  documentName?: string | null;
  documentMime?: string | null;
  approvedByName?: string | null;
  signatureVersion?: string | null;
  signatureCapturedAt?: Date | null;
  signaturePayload?: unknown;
};

export type PhotoConsentPurposeRecord = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  appliesTo: PhotoConsentPurposeAudience;
  isRefusal: boolean;
  sortOrder: number;
};

export type PhotoConsentChoiceRecord = {
  purposeId: string;
  chosen: boolean;
};

export type PhotoConsentVersionRecord = {
  id: string;
  version: number;
  status: PersistedPhotoConsentStatus;
  submittedAt: Date;
  source: string;
  documentName: string | null;
  documentUploadedAt: Date | null;
  signatureVersion: string | null;
  purposesSnapshot: unknown;
};

export type PhotoConsentCatalog = {
  purposes: readonly PhotoConsentPurposeRecord[];
  choices: readonly PhotoConsentChoiceRecord[];
  versions: readonly PhotoConsentVersionRecord[];
};

const EMPTY_CATALOG: PhotoConsentCatalog = { purposes: [], choices: [], versions: [] };

type PhotoConsentUserLike = {
  dateOfBirth: Date | null;
  photoConsent: ConsentRecord | null;
};

export function calculatePhotoConsentAge(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

/** Kombiniert Katalog und angekreuzte Auswahl zu anzeigbaren Zwecken. */
export function buildPhotoConsentPurposeViews(
  purposes: readonly PhotoConsentPurposeRecord[],
  choices: readonly PhotoConsentChoiceRecord[],
  age: number | null,
): PhotoConsentPurposeView[] {
  const audience = resolvePhotoConsentAudience(age);
  const chosenByPurpose = new Map(choices.map((choice) => [choice.purposeId, choice.chosen]));

  return purposes
    .filter((purpose) => (audience ? purposeAppliesToAudience(purpose.appliesTo, audience) : true))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((purpose) => ({
      purposeId: purpose.id,
      code: purpose.code,
      label: purpose.label,
      description: purpose.description,
      appliesTo: purpose.appliesTo,
      isRefusal: purpose.isRefusal,
      chosen: chosenByPurpose.get(purpose.id) ?? false,
    }));
}

function parsePurposeSnapshot(value: unknown): PhotoConsentPurposeSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const record = entry as { code?: unknown; label?: unknown; chosen?: unknown };
    if (typeof record.code !== "string" || typeof record.label !== "string") {
      return [];
    }
    return [{ code: record.code, label: record.label, chosen: record.chosen === true }];
  });
}

export function buildPhotoConsentVersionViews(
  versions: readonly PhotoConsentVersionRecord[],
): PhotoConsentVersionView[] {
  return versions
    .slice()
    .sort((a, b) => b.version - a.version)
    .map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      submittedAt: version.submittedAt.toISOString(),
      source: version.source,
      hasDocument: Boolean(version.documentUploadedAt),
      documentName: version.documentName,
      documentUrl: version.documentUploadedAt
        ? `/api/photo-consents/versions/${version.id}/document`
        : null,
      signatureVersion: version.signatureVersion,
      purposes: parsePurposeSnapshot(version.purposesSnapshot),
    }));
}

export function buildPhotoConsentSummary(
  user: PhotoConsentUserLike,
  catalog: PhotoConsentCatalog = EMPTY_CATALOG,
): PhotoConsentSummary {
  const consent = user.photoConsent;
  const dateOfBirth = user.dateOfBirth;
  const age = calculatePhotoConsentAge(dateOfBirth);
  const requiresDocument = age !== null && age < 18;
  const requiresDateOfBirth = !dateOfBirth;

  const status = consent?.status ?? "none";
  const documentMime = consent?.documentMime ?? null;
  const documentPreviewUrl =
    consent?.documentUploadedAt && consent?.id && documentMime?.toLowerCase().startsWith("image/")
      ? `/api/photo-consents/${consent.id}/document?mode=inline`
      : null;

  const signatureVersion = consent?.signatureVersion ?? null;
  const signatureCapturedAt =
    consent?.signatureCapturedAt && !Number.isNaN(consent.signatureCapturedAt.valueOf())
      ? consent.signatureCapturedAt.toISOString()
      : null;

  let signaturePayload: SignaturePayload | null = null;
  if (consent?.signaturePayload) {
    const parsed = signaturePayloadSchema.safeParse(consent.signaturePayload);
    if (parsed.success) {
      signaturePayload = parsed.data;
    }
  }

  return {
    status,
    revokedAt: consent?.revokedAt?.toISOString() ?? null,
    requiresDocument,
    requiresDateOfBirth,
    hasDocument: Boolean(consent?.documentUploadedAt),
    submittedAt: consent?.createdAt?.toISOString() ?? null,
    updatedAt: consent?.updatedAt?.toISOString() ?? null,
    approvedAt: consent?.approvedAt?.toISOString() ?? null,
    approvedByName: consent?.approvedByName ?? null,
    rejectionReason: consent?.rejectionReason ?? null,
    exclusionNote: consent?.exclusionNote ?? null,
    age,
    dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
    documentName: consent?.documentName ?? null,
    documentUploadedAt: consent?.documentUploadedAt
      ? consent.documentUploadedAt.toISOString()
      : null,
    documentMime,
    documentPreviewUrl,
    signatureVersion,
    signatureCapturedAt,
    signaturePayload,
    purposes: buildPhotoConsentPurposeViews(catalog.purposes, catalog.choices, age),
    versions: buildPhotoConsentVersionViews(catalog.versions),
  };
}
