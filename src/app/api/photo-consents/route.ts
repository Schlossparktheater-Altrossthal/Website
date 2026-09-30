import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  firstConsent,
  photoConsentsForShow,
  resolvePhotoConsentShowId,
} from "@/lib/photo-consent-scope";
import { getUserDisplayName } from "@/lib/names";
import {
  createPhotoConsentBoardNotification,
  dispatchPhotoConsentBoardNotification,
} from "@/lib/photo-consent-notifications";
import {
  buildPhotoConsentSummary,
  calculatePhotoConsentAge,
  type PhotoConsentPurposeRecord,
} from "@/lib/photo-consent-summary";
import { listPhotoConsentPurposes } from "@/lib/photo-consent-purposes";
import {
  appendPhotoConsentVersion,
  buildPhotoConsentPurposeSnapshot,
  derivePhotoConsentStatus,
  normalizePhotoConsentSelection,
} from "@/lib/photo-consent-submission";
import { signaturePayloadSchema, type SignaturePayload } from "@/types/signature";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_EXCLUSION_NOTE = 1000;
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);

type UploadedFile = {
  name?: string | null;
  type?: string | null;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type PurposeRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  appliesTo: PhotoConsentPurposeRecord["appliesTo"];
  isRefusal: boolean;
  sortOrder: number;
};

function isFileLike(value: unknown): value is UploadedFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const maybeFile = value as Partial<UploadedFile>;
  return typeof maybeFile.size === "number" && typeof maybeFile.arrayBuffer === "function";
}

function toPurposeRecord(purpose: PurposeRow): PhotoConsentPurposeRecord {
  return {
    id: purpose.id,
    code: purpose.code,
    label: purpose.label,
    description: purpose.description,
    appliesTo: purpose.appliesTo,
    isRefusal: purpose.isRefusal,
    sortOrder: purpose.sortOrder,
  };
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return value === true;
}

function parseSelection(value: unknown): Array<{ purposeId: string; chosen: boolean }> {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const record = entry as { purposeId?: unknown; chosen?: unknown };
    if (typeof record.purposeId !== "string") {
      return [];
    }
    return [{ purposeId: record.purposeId, chosen: record.chosen === true }];
  });
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "einverstaendnis.pdf";
  }
  return trimmed.replace(/[^\w. -]+/g, "_");
}

export async function GET() {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const showId = await resolvePhotoConsentShowId(userId);
  const purposes = showId ? await listPhotoConsentPurposes(showId) : [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dateOfBirth: true,
      photoConsents: photoConsentsForShow(
        showId,
        {
          id: true,
          status: true,
          revokedAt: true,
          createdAt: true,
          updatedAt: true,
          approvedAt: true,
          rejectionReason: true,
          exclusionNote: true,
          documentUploadedAt: true,
          documentName: true,
          documentMime: true,
          signatureVersion: true,
          signatureCapturedAt: true,
          signaturePayload: true,
          approvedBy: { select: { name: true } },
          choices: { select: { purposeId: true, chosen: true } },
          versions: {
            orderBy: { version: "desc" },
            select: {
              id: true,
              version: true,
              status: true,
              submittedAt: true,
              source: true,
              documentName: true,
              documentUploadedAt: true,
              signatureVersion: true,
              purposesSnapshot: true,
            },
          },
        },
        { includeRevoked: true },
      ),
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const consent = firstConsent(user.photoConsents);

  const summary = buildPhotoConsentSummary(
    {
      dateOfBirth: user.dateOfBirth,
      photoConsent: consent
        ? {
            ...consent,
            approvedByName: consent.approvedBy?.name ?? null,
            signaturePayload: consent.signaturePayload ?? null,
          }
        : null,
    },
    {
      purposes: purposes.map(toPurposeRecord),
      choices: consent?.choices ?? [],
      versions: consent?.versions ?? [],
    },
  );

  return NextResponse.json({ consent: summary });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> | null = null;
  const documentFiles: UploadedFile[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const parsed: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (isFileLike(value)) {
        if (key === "document" && value.size > 0) {
          documentFiles.push(value);
        }
      } else if (typeof value === "string") {
        parsed[key] = value;
      }
    });
    body = parsed;
  } else {
    const json = await request.json().catch(() => null);
    if (json && typeof json === "object") {
      body = json as Record<string, unknown>;
    }
  }

  if (!body) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  if (parseBoolean(body.revoke)) {
    const revokeShowId = await resolvePhotoConsentShowId(userId);
    if (!revokeShowId) {
      return NextResponse.json(
        { error: "Du bist aktuell keiner Produktion zugeordnet" },
        { status: 409 },
      );
    }

    const existing = await prisma.photoConsent.findUnique({
      where: { userId_showId: { userId, showId: revokeShowId } },
      select: { id: true, revokedAt: true, exclusionNote: true },
    });
    if (!existing || existing.revokedAt) {
      return NextResponse.json(
        { error: "Es gibt keine aktive Einwilligung, die widerrufen werden kann" },
        { status: 409 },
      );
    }

    const subject = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, name: true, email: true },
    });
    const actorName = getUserDisplayName(
      {
        firstName: subject?.firstName ?? null,
        lastName: subject?.lastName ?? null,
        name: subject?.name ?? null,
        email: subject?.email ?? null,
      },
      "Unbekanntes Mitglied",
    );
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.photoConsent.update({
        where: { id: existing.id },
        data: {
          revokedAt: now,
          approvedAt: null,
          approvedById: null,
          rejectionReason: null,
        },
      });
      await appendPhotoConsentVersion(tx, {
        consentId: existing.id,
        status: "noPhotos",
        purposesSnapshot: [],
        exclusionNote: existing.exclusionNote,
        document: null,
        signature: null,
        submittedById: userId,
        source: "revocation",
      });
      await createPhotoConsentBoardNotification(tx, {
        consentId: existing.id,
        status: "noPhotos",
        hasDocument: false,
        subjectUserId: userId,
        subjectName: actorName,
        changeType: "status-changed",
        actorUserId: userId,
        actorName,
      });
    });

    return NextResponse.json({ revoked: true, revokedAt: now.toISOString() });
  }

  if (!parseBoolean(body.confirm)) {
    return NextResponse.json({ error: "Bitte bestätige dein Einverständnis" }, { status: 400 });
  }

  const rawExclusionNote = typeof body.exclusionNote === "string" ? body.exclusionNote.trim() : "";
  if (rawExclusionNote.length > MAX_EXCLUSION_NOTE) {
    return NextResponse.json(
      { error: `Bitte kürze deine Hinweise auf maximal ${MAX_EXCLUSION_NOTE} Zeichen` },
      { status: 400 },
    );
  }
  const exclusionNote = rawExclusionNote ? rawExclusionNote : null;

  const showId = await resolvePhotoConsentShowId(userId);
  if (!showId) {
    return NextResponse.json(
      { error: "Du bist aktuell keiner Produktion zugeordnet" },
      { status: 409 },
    );
  }

  const purposeRows = await listPhotoConsentPurposes(showId);
  const purposes = purposeRows.map(toPurposeRecord);

  const selection = parseSelection(body.purposes);
  const { choices, isRefusal } = normalizePhotoConsentSelection(purposes, selection);
  const status = derivePhotoConsentStatus(isRefusal);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      dateOfBirth: true,
      photoConsents: photoConsentsForShow(showId, {
        id: true,
        status: true,
        documentUploadedAt: true,
      }),
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const existingConsent = firstConsent(user.photoConsents);
  const documentFile = documentFiles[0] ?? null;

  const requiresDateOfBirth = !user.dateOfBirth;
  if (requiresDateOfBirth && status !== "noPhotos") {
    return NextResponse.json(
      { error: "Bitte hinterlege zuerst dein Geburtsdatum im Profil", requiresDateOfBirth: true },
      { status: 400 },
    );
  }

  const age = calculatePhotoConsentAge(user.dateOfBirth);
  const requiresDocument = age !== null && age < 18;

  if (
    status === "pending" &&
    requiresDocument &&
    !documentFile &&
    !existingConsent?.documentUploadedAt
  ) {
    return NextResponse.json(
      { error: "Bitte lade die unterschriebene Einverständniserklärung hoch" },
      { status: 400 },
    );
  }

  let signaturePayload: SignaturePayload | null = null;
  let signatureVersion: string | null = null;
  let signatureCapturedAt: Date | null = null;

  const rawSignaturePayload = body.signaturePayload;
  if (rawSignaturePayload !== undefined && rawSignaturePayload !== null) {
    let parsedValue: unknown = null;
    if (typeof rawSignaturePayload === "string") {
      const trimmed = rawSignaturePayload.trim();
      if (trimmed) {
        try {
          parsedValue = JSON.parse(trimmed);
        } catch {
          return NextResponse.json(
            { error: "Signaturdaten konnten nicht gelesen werden" },
            { status: 400 },
          );
        }
      }
    } else if (typeof rawSignaturePayload === "object") {
      parsedValue = rawSignaturePayload;
    }

    if (parsedValue) {
      const parsed = signaturePayloadSchema.safeParse(parsedValue);
      if (!parsed.success) {
        return NextResponse.json({ error: "Ungültige Signaturdaten" }, { status: 400 });
      }
      signaturePayload = parsed.data;
      signatureVersion = parsed.data.version;
      const parsedDate = new Date(parsed.data.endedAt);
      signatureCapturedAt = Number.isNaN(parsedDate.valueOf()) ? new Date() : parsedDate;
    }
  }

  let documentBuffer: Uint8Array<ArrayBuffer> | null = null;
  let documentMime: string | null = null;
  let documentName: string | null = null;
  let documentSize: number | null = null;

  if (documentFile) {
    const upload = documentFile;
    if (upload.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dokument darf maximal 8 MB groß sein" }, { status: 400 });
    }
    const mime = upload.type?.toLowerCase() ?? "";
    if (mime && !ALLOWED_DOCUMENT_TYPES.has(mime)) {
      return NextResponse.json(
        { error: "Erlaubt sind PDF oder Bilddateien (JPG, PNG)" },
        { status: 400 },
      );
    }
    documentBuffer = new Uint8Array(await upload.arrayBuffer());
    documentMime = mime || "application/octet-stream";
    documentName = sanitizeFilename(upload.name || "einverstaendnis.pdf");
    documentSize = upload.size;
  }

  const now = new Date();
  const docData = documentBuffer
    ? {
        documentData: documentBuffer,
        documentMime,
        documentName,
        documentSize,
        documentUploadedAt: now,
      }
    : {};

  const signatureData = signaturePayload
    ? { signatureVersion, signaturePayload, signatureCapturedAt: signatureCapturedAt ?? now }
    : documentBuffer
      ? { signatureVersion: null, signaturePayload: Prisma.JsonNull, signatureCapturedAt: null }
      : {};

  const actorDisplayName = getUserDisplayName(
    {
      firstName: session.user?.firstName ?? null,
      lastName: session.user?.lastName ?? null,
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
    },
    "Unbekanntes Mitglied",
  );

  const subjectDisplayName = getUserDisplayName(
    { firstName: user.firstName, lastName: user.lastName, name: user.name, email: user.email },
    "Unbekanntes Mitglied",
  );

  const purposesSnapshot = buildPhotoConsentPurposeSnapshot(purposes, choices);

  const { notification } = await prisma.$transaction(async (tx) => {
    const consent = await tx.photoConsent.upsert({
      where: { userId_showId: { userId, showId } },
      create: {
        userId,
        showId,
        status,
        approvedAt: null,
        approvedById: null,
        rejectionReason: null,
        exclusionNote,
        ...docData,
        ...signatureData,
      },
      update: {
        status,
        approvedAt: null,
        approvedById: null,
        rejectionReason: null,
        revokedAt: null,
        exclusionNote,
        ...(documentBuffer ? docData : {}),
        ...(signaturePayload || documentBuffer ? signatureData : {}),
      },
      select: {
        id: true,
        status: true,
        documentUploadedAt: true,
      },
    });

    await tx.photoConsentChoice.deleteMany({ where: { consentId: consent.id } });
    if (choices.length > 0) {
      await tx.photoConsentChoice.createMany({
        data: choices.map((choice) => ({
          consentId: consent.id,
          purposeId: choice.purposeId,
          chosen: choice.chosen,
        })),
      });
    }

    await appendPhotoConsentVersion(tx, {
      consentId: consent.id,
      status,
      purposesSnapshot,
      exclusionNote,
      document: documentBuffer
        ? {
            name: documentName ?? "einverstaendnis.pdf",
            mime: documentMime ?? "",
            size: documentSize ?? 0,
            data: documentBuffer,
          }
        : null,
      signature: signaturePayload
        ? {
            version: signatureVersion ?? "velocity.v1",
            capturedAt: signatureCapturedAt ?? now,
            payload: signaturePayload,
          }
        : null,
      submittedById: userId,
      source: "member",
    });

    const notification = await createPhotoConsentBoardNotification(tx, {
      consentId: consent.id,
      status: consent.status,
      hasDocument: Boolean(consent.documentUploadedAt),
      subjectUserId: userId,
      subjectName: subjectDisplayName,
      changeType: "submitted",
      actorUserId: session.user?.id ?? null,
      actorName: actorDisplayName,
      rejectionReason: null,
    });

    return { notification };
  });

  if (notification) {
    await dispatchPhotoConsentBoardNotification(notification);
  }

  return NextResponse.json({ ok: true });
}
