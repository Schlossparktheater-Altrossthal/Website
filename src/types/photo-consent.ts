import type { PhotoConsentPurposeAudience } from "@prisma/client";

import type { SignaturePayload } from "./signature";

export type PhotoConsentStatus = "none" | "pending" | "approved" | "rejected" | "noPhotos";

export type PhotoConsentAudienceValue = PhotoConsentPurposeAudience;

/** Ein ankreuzbarer Zweck mit dem Zustand für die anzeigende Person. */
export type PhotoConsentPurposeView = {
  purposeId: string;
  code: string;
  label: string;
  description: string | null;
  appliesTo: PhotoConsentAudienceValue;
  isRefusal: boolean;
  chosen: boolean;
};

/** Snapshot eines Zwecks in einer archivierten Version. */
export type PhotoConsentPurposeSnapshot = {
  code: string;
  label: string;
  chosen: boolean;
};

export type PhotoConsentVersionView = {
  id: string;
  version: number;
  status: Exclude<PhotoConsentStatus, "none">;
  submittedAt: string;
  source: string;
  hasDocument: boolean;
  documentName: string | null;
  documentUrl: string | null;
  signatureVersion: string | null;
  purposes: PhotoConsentPurposeSnapshot[];
};

export type PhotoConsentSummary = {
  status: PhotoConsentStatus;
  requiresDocument: boolean;
  hasDocument: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectionReason: string | null;
  exclusionNote: string | null;
  requiresDateOfBirth: boolean;
  age: number | null;
  dateOfBirth: string | null;
  documentName: string | null;
  documentUploadedAt: string | null;
  documentMime: string | null;
  documentPreviewUrl: string | null;
  signatureVersion: string | null;
  signatureCapturedAt: string | null;
  signaturePayload: SignaturePayload | null;
  purposes: PhotoConsentPurposeView[];
  versions: PhotoConsentVersionView[];
};

export type PhotoConsentAdminEntry = {
  id: string;
  userId: string;
  showId: string;
  showTitle: string;
  name: string | null;
  email: string | null;
  status: Exclude<PhotoConsentStatus, "none">;
  submittedAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectionReason: string | null;
  exclusionNote: string | null;
  hasDocument: boolean;
  requiresDocument: boolean;
  requiresDateOfBirth: boolean;
  dateOfBirth: string | null;
  age: number | null;
  documentName: string | null;
  documentUrl: string | null;
  documentUploadedAt: string | null;
  documentMime: string | null;
  documentPreviewUrl: string | null;
  signatureVersion: string | null;
  signatureCapturedAt: string | null;
  signaturePayload: SignaturePayload | null;
  purposes: PhotoConsentPurposeView[];
  versions: PhotoConsentVersionView[];
};

export type PhotoConsentShowOption = {
  id: string;
  title: string;
  year: number;
  status: "planning" | "active" | "finished" | "archived";
};

export type PhotoConsentPurposeAdminEntry = {
  id: string;
  showId: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  appliesTo: PhotoConsentAudienceValue;
  isRefusal: boolean;
  isActive: boolean;
  choiceCount: number;
};
