import { Prisma } from "@prisma/client";

import type {
  PhotoConsentChoiceRecord,
  PhotoConsentPurposeRecord,
  PersistedPhotoConsentStatus,
} from "@/lib/photo-consent-summary";
import type { PhotoConsentPurposeSnapshot } from "@/types/photo-consent";

export type PhotoConsentSelectionInput = ReadonlyArray<{ purposeId: string; chosen: boolean }>;

export type NormalizedPhotoConsentSelection = {
  /** Alle Zwecke mit ihrem Zustand (Basis für die Choice-Tabelle). */
  choices: PhotoConsentChoiceRecord[];
  /** true, wenn der Ablehnungs-Zweck („gar nicht“) angekreuzt ist. */
  isRefusal: boolean;
};

/**
 * Normalisiert die Auswahl: unbekannte IDs werden verworfen, „gar nicht“ ist exklusiv
 * (ist es angekreuzt, gelten alle anderen als nicht angekreuzt).
 */
export function normalizePhotoConsentSelection(
  purposes: readonly PhotoConsentPurposeRecord[],
  selection: PhotoConsentSelectionInput,
): NormalizedPhotoConsentSelection {
  const knownIds = new Set(purposes.map((purpose) => purpose.id));
  const chosenByPurpose = new Map<string, boolean>();

  for (const entry of selection) {
    if (!knownIds.has(entry.purposeId)) {
      continue;
    }
    chosenByPurpose.set(entry.purposeId, entry.chosen);
  }

  const isRefusal = purposes.some(
    (purpose) => purpose.isRefusal && chosenByPurpose.get(purpose.id) === true,
  );

  const choices: PhotoConsentChoiceRecord[] = purposes.map((purpose) => ({
    purposeId: purpose.id,
    chosen: isRefusal
      ? purpose.isRefusal && chosenByPurpose.get(purpose.id) === true
      : chosenByPurpose.get(purpose.id) === true,
  }));

  return { choices, isRefusal };
}

/** Snapshot der angekreuzten Zwecke für die Versionshistorie. */
export function buildPhotoConsentPurposeSnapshot(
  purposes: readonly PhotoConsentPurposeRecord[],
  choices: readonly PhotoConsentChoiceRecord[],
): PhotoConsentPurposeSnapshot[] {
  const chosenByPurpose = new Map(choices.map((choice) => [choice.purposeId, choice.chosen]));
  return purposes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((purpose) => ({
      code: purpose.code,
      label: purpose.label,
      chosen: chosenByPurpose.get(purpose.id) ?? false,
    }));
}

/** Ohne Einverständnis ist der Zustand sofort „keine Aufnahmen“, sonst wartet er auf Prüfung. */
export function derivePhotoConsentStatus(isRefusal: boolean): "noPhotos" | "pending" {
  return isRefusal ? "noPhotos" : "pending";
}

/**
 * Legt beim Onboarding die Standard-Zwecke als Vorauswahl an (alle erlaubten außer „gar nicht“).
 * Die Detail-Auswahl pflegt das Mitglied später im Profil.
 */
export async function seedDefaultPhotoConsentChoices(
  tx: Prisma.TransactionClient,
  consentId: string,
  showId: string,
  isMinor: boolean,
): Promise<void> {
  const purposes = await tx.photoConsentPurpose.findMany({
    where: { showId, isActive: true, isRefusal: false },
    orderBy: [{ sortOrder: "asc" }],
  });
  const audience = isMinor ? "minor" : "adult";
  const selected = purposes.filter(
    (purpose) => purpose.appliesTo === "both" || purpose.appliesTo === audience,
  );
  if (selected.length === 0) {
    return;
  }
  await tx.photoConsentChoice.createMany({
    data: selected.map((purpose) => ({ consentId, purposeId: purpose.id, chosen: true })),
    skipDuplicates: true,
  });
}

export type PhotoConsentVersionPayload = {
  consentId: string;
  status: PersistedPhotoConsentStatus;
  purposesSnapshot: Prisma.InputJsonValue;
  exclusionNote: string | null;
  document: { name: string; mime: string; size: number; data: Uint8Array<ArrayBuffer> } | null;
  signature: { version: string; capturedAt: Date; payload: Prisma.InputJsonValue } | null;
  submittedById: string | null;
  source: string;
};

/**
 * Hängt eine unveränderliche Version an eine Fotoerlaubnis an. Die Versionsnummer zählt je
 * Erlaubnis hoch; die aktuelle Auswahl wird als Snapshot mitgeschrieben.
 */
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
      purposesSnapshot: payload.purposesSnapshot,
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
