import type { PhotoConsentLevelValue } from "@/lib/photo-consent-levels";

import type { SignaturePayload } from "./signature";

export type PhotoConsentStatus = "none" | "pending" | "approved" | "rejected" | "noPhotos";

export type PhotoConsentVersionView = {
  id: string;
  version: number;
  status: Exclude<PhotoConsentStatus, "none">;
  /** Stufe dieser Version; `null` bei Altversionen ohne erkennbare Auswahl. */
  level: PhotoConsentLevelValue | null;
  submittedAt: string;
  source: string;
  hasDocument: boolean;
  documentName: string | null;
  documentUrl: string | null;
  signatureVersion: string | null;
  exclusionNote: string | null;
};

/** Erlaubnis aus einer früheren Produktion, zum Vorausfüllen bei Volljährigen. */
export type PhotoConsentPrevious = {
  showTitle: string;
  level: PhotoConsentLevelValue;
  exclusionNote: string | null;
};

export type PhotoConsentSummary = {
  status: PhotoConsentStatus;
  /** Gewählte Stufe; `null`, wenn noch nichts oder nur ein Altbestand ohne Stufe vorliegt. */
  level: PhotoConsentLevelValue | null;
  revokedAt: string | null;
  /** Minderjährig: Nachweis muss von den Eltern stammen. */
  requiresDocument: boolean;
  hasDocument: boolean;
  /** Dokument oder digitale Unterschrift liegt vor. */
  hasProof: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectionReason: string | null;
  /** Freies Hinweisfeld („Hinweis“), z. B. „keine Nahaufnahmen“. */
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
  showTitle: string | null;
  previous: PhotoConsentPrevious | null;
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
  level: PhotoConsentLevelValue | null;
  submittedAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectionReason: string | null;
  exclusionNote: string | null;
  hasDocument: boolean;
  hasProof: boolean;
  requiresDocument: boolean;
  requiresDateOfBirth: boolean;
  isMinor: boolean;
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
  versions: PhotoConsentVersionView[];
};

/** Mitglied der Produktion, das noch keine Fotoerlaubnis abgegeben hat. */
export type PhotoConsentMissingEntry = {
  userId: string;
  name: string;
  email: string | null;
  isMinor: boolean;
};

export type PhotoConsentShowOption = {
  id: string;
  title: string;
  year: number;
  status: "planning" | "active" | "finished" | "archived";
};
