import type { PhotoConsentSummary } from "@/types/photo-consent";

type ConsentRecord = {
  id?: string;
  status: "pending" | "approved" | "rejected" | "none";
  createdAt?: Date | null;
  updatedAt?: Date | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  exclusionNote?: string | null;
  documentUploadedAt?: Date | null;
  documentName?: string | null;
  documentMime?: string | null;
  approvedByName?: string | null;
};

type PhotoConsentUserLike = {
  dateOfBirth: Date | null;
  photoConsent: ConsentRecord | null;
};

export function calculatePhotoConsentAge(
  date: Date | null | undefined,
): number | null {
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

export function buildPhotoConsentSummary(
  user: PhotoConsentUserLike,
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

  return {
    status,
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
  };
}
