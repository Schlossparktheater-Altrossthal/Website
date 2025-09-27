export type PhotoConsentStatus = "none" | "pending" | "approved" | "rejected";

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
};

export type PhotoConsentAdminEntry = {
  id: string;
  userId: string;
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
};
