import { Prisma } from "@prisma/client";

import {
  MAX_PHOTO_CONSENT_NOTE,
  isPhotoConsentLevelAllowed,
  photoConsentStatusForLevel,
  type PhotoConsentLevelValue,
} from "@/lib/photo-consent-levels";
import type { PersistedPhotoConsentStatus } from "@/lib/photo-consent-summary";
import { signaturePayloadSchema, type SignaturePayload } from "@/types/signature";

export { MAX_PHOTO_CONSENT_NOTE };

export type PhotoConsentDocumentInput = {
  name: string;
  mime: string;
  size: number;
  data: Uint8Array<ArrayBuffer>;
};

export type PhotoConsentSignatureInput = {
  version: string;
  capturedAt: Date;
  payload: SignaturePayload;
};

export type PhotoConsentSubmissionCheck = {
  level: PhotoConsentLevelValue;
  isMinor: boolean | null;
  hasDateOfBirth: boolean;
  /** Neuer Nachweis (Dokument oder Unterschrift) liegt dieser Einreichung bei. */
  hasNewProof: boolean;
  /** Für diese Produktion liegt schon ein Nachweis vor. */
  hasExistingProof: boolean;
  /** Nur Minderjährige: Eltern-Nachweis wird später nachgereicht. */
  deferProof: boolean;
};

/**
 * Prüft eine Einreichung und liefert eine Fehlermeldung oder `null`. „Gar nicht“ braucht weder
 * Geburtsdatum noch Nachweis; sonst ist für jede Produktion ein Nachweis Pflicht (E4), den nur
 * Minderjährige nachreichen dürfen.
 */
export function checkPhotoConsentSubmission(input: PhotoConsentSubmissionCheck): string | null {
  if (input.level === "none") {
    return null;
  }
  if (!input.hasDateOfBirth || input.isMinor === null) {
    return "Bitte hinterlege zuerst dein Geburtsdatum im Profil";
  }
  if (!isPhotoConsentLevelAllowed(input.level, input.isMinor)) {
    return "Diese Stufe gibt es nur für Volljährige";
  }
  if (input.hasNewProof || input.hasExistingProof) {
    return null;
  }
  if (input.isMinor && input.deferProof) {
    return null;
  }
  return input.isMinor
    ? "Bitte lass ein Elternteil unterschreiben oder lade das unterschriebene Formular hoch"
    : "Bitte unterschreibe die Fotoerlaubnis";
}

type ProofFields = Pick<
  Prisma.PhotoConsentUncheckedCreateInput,
  | "documentData"
  | "documentMime"
  | "documentName"
  | "documentSize"
  | "documentUploadedAt"
  | "signatureVersion"
  | "signaturePayload"
  | "signatureCapturedAt"
>;

export type PersistPhotoConsentInput = {
  userId: string;
  showId: string;
  level: PhotoConsentLevelValue;
  exclusionNote: string | null;
  document: PhotoConsentDocumentInput | null;
  signature: PhotoConsentSignatureInput | null;
  submittedById: string | null;
  source: string;
};

/**
 * Speichert eine Einreichung: aktualisiert die Fotoerlaubnis der Produktion und hängt eine
 * Version an. Ein neuer Nachweis ersetzt den alten vollständig (Dokument oder Unterschrift,
 * nie beides); ohne neuen Nachweis bleibt der vorhandene stehen.
 */
export async function persistPhotoConsentSubmission(
  tx: Prisma.TransactionClient,
  input: PersistPhotoConsentInput,
): Promise<{ id: string; status: PersistedPhotoConsentStatus; hasProof: boolean }> {
  const status = photoConsentStatusForLevel(input.level);
  const now = new Date();

  const proofData: ProofFields = input.document
    ? {
        documentData: input.document.data,
        documentMime: input.document.mime,
        documentName: input.document.name,
        documentSize: input.document.size,
        documentUploadedAt: now,
        signatureVersion: null,
        signaturePayload: Prisma.JsonNull,
        signatureCapturedAt: null,
      }
    : input.signature
      ? {
          documentData: null,
          documentMime: null,
          documentName: null,
          documentSize: null,
          documentUploadedAt: null,
          signatureVersion: input.signature.version,
          signaturePayload: input.signature.payload,
          signatureCapturedAt: input.signature.capturedAt,
        }
      : {};

  const base = {
    status,
    level: input.level,
    exclusionNote: input.exclusionNote,
    approvedAt: null,
    approvedById: null,
    rejectionReason: null,
  };

  const consent = await tx.photoConsent.upsert({
    where: { userId_showId: { userId: input.userId, showId: input.showId } },
    create: {
      userId: input.userId,
      showId: input.showId,
      ...base,
      ...proofData,
    },
    update: { ...base, revokedAt: null, ...proofData },
    select: { id: true, status: true, documentUploadedAt: true, signatureCapturedAt: true },
  });

  await appendPhotoConsentVersion(tx, {
    consentId: consent.id,
    status,
    level: input.level,
    exclusionNote: input.exclusionNote,
    document: input.document,
    signature: input.signature
      ? {
          version: input.signature.version,
          capturedAt: input.signature.capturedAt,
          payload: input.signature.payload,
        }
      : null,
    submittedById: input.submittedById,
    source: input.source,
  });

  return {
    id: consent.id,
    status: consent.status,
    hasProof: Boolean(consent.documentUploadedAt || consent.signatureCapturedAt),
  };
}

export type PhotoConsentVersionPayload = {
  consentId: string;
  status: PersistedPhotoConsentStatus;
  level: PhotoConsentLevelValue | null;
  exclusionNote: string | null;
  document: PhotoConsentDocumentInput | null;
  signature: { version: string; capturedAt: Date; payload: Prisma.InputJsonValue } | null;
  submittedById: string | null;
  source: string;
};

/** Hängt eine unveränderliche Version an eine Fotoerlaubnis an (Nummer zählt je Erlaubnis hoch). */
export async function appendPhotoConsentVersion(
  tx: Prisma.TransactionClient,
  payload: PhotoConsentVersionPayload,
): Promise<number> {
  const last = await tx.photoConsentVersion.findFirst({
    where: { consentId: payload.consentId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const now = new Date();

  await tx.photoConsentVersion.create({
    data: {
      consentId: payload.consentId,
      version,
      status: payload.status,
      level: payload.level,
      purposesSnapshot: Prisma.JsonNull,
      exclusionNote: payload.exclusionNote,
      documentName: payload.document?.name ?? null,
      documentMime: payload.document?.mime ?? null,
      documentSize: payload.document?.size ?? null,
      documentData: payload.document?.data ?? null,
      documentUploadedAt: payload.document ? now : null,
      signatureVersion: payload.signature?.version ?? null,
      signatureCapturedAt: payload.signature?.capturedAt ?? null,
      signaturePayload: payload.signature ? payload.signature.payload : Prisma.JsonNull,
      submittedById: payload.submittedById,
      source: payload.source,
    },
  });

  return version;
}

/** Liest Unterschrift-Daten aus einem Formularfeld (JSON-String oder Objekt). */
export function parseSignatureInput(raw: unknown): {
  signature: PhotoConsentSignatureInput | null;
  error: string | null;
} {
  if (raw === undefined || raw === null || raw === "") {
    return { signature: null, error: null };
  }
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { signature: null, error: "Signaturdaten konnten nicht gelesen werden" };
    }
  }
  const parsed = signaturePayloadSchema.safeParse(value);
  if (!parsed.success) {
    return { signature: null, error: "Ungültige Signaturdaten" };
  }
  const endedAt = new Date(parsed.data.endedAt);
  return {
    signature: {
      version: parsed.data.version,
      capturedAt: Number.isNaN(endedAt.valueOf()) ? new Date() : endedAt,
      payload: parsed.data,
    },
    error: null,
  };
}
