import type { PhotoConsentLevelValue } from "@/lib/photo-consent-levels";
import type {
  PhotoConsentPrevious,
  PhotoConsentSummary,
  PhotoConsentVersionView,
} from "@/types/photo-consent";
import { signaturePayloadSchema, type SignaturePayload } from "@/types/signature";

/** Status, wie er in der Datenbank steht (ohne das abgeleitete „none“). */
export type PersistedPhotoConsentStatus = "pending" | "approved" | "rejected" | "noPhotos";

type ConsentRecord = {
  id?: string;
  status: PersistedPhotoConsentStatus | "none";
  level?: PhotoConsentLevelValue | null;
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

export type PhotoConsentVersionRecord = {
  id: string;
  version: number;
  status: PersistedPhotoConsentStatus;
  level?: PhotoConsentLevelValue | null;
  submittedAt: Date;
  source: string;
  documentName: string | null;
  documentUploadedAt: Date | null;
  signatureVersion: string | null;
  exclusionNote?: string | null;
};

export type PhotoConsentSummaryExtras = {
  versions?: readonly PhotoConsentVersionRecord[];
  showTitle?: string | null;
  previous?: PhotoConsentPrevious | null;
};

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

export function parseSignaturePayload(value: unknown): SignaturePayload | null {
  if (!value) return null;
  const parsed = signaturePayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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
      level: version.level ?? null,
      submittedAt: version.submittedAt.toISOString(),
      source: version.source,
      hasDocument: Boolean(version.documentUploadedAt),
      documentName: version.documentName,
      documentUrl: version.documentUploadedAt
        ? `/api/photo-consents/versions/${version.id}/document`
        : null,
      signatureVersion: version.signatureVersion,
      exclusionNote: version.exclusionNote ?? null,
    }));
}

export function buildPhotoConsentSummary(
  user: PhotoConsentUserLike,
  extras: PhotoConsentSummaryExtras = {},
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

  const signatureCapturedAt =
    consent?.signatureCapturedAt && !Number.isNaN(consent.signatureCapturedAt.valueOf())
      ? consent.signatureCapturedAt.toISOString()
      : null;
  const signaturePayload = parseSignaturePayload(consent?.signaturePayload);
  const hasDocument = Boolean(consent?.documentUploadedAt);

  return {
    status,
    level: consent?.level ?? null,
    revokedAt: consent?.revokedAt?.toISOString() ?? null,
    requiresDocument,
    requiresDateOfBirth,
    hasDocument,
    hasProof: hasDocument || Boolean(signaturePayload),
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
    signatureVersion: consent?.signatureVersion ?? null,
    signatureCapturedAt,
    signaturePayload,
    showTitle: extras.showTitle ?? null,
    previous: extras.previous ?? null,
    versions: buildPhotoConsentVersionViews(extras.versions ?? []),
  };
}
