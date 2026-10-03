import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  firstConsent,
  loadPreviousPhotoConsent,
  photoConsentsForShow,
  resolvePhotoConsentShowId,
} from "@/lib/photo-consent-scope";
import { getUserDisplayName } from "@/lib/names";
import {
  createPhotoConsentBoardNotification,
  dispatchPhotoConsentBoardNotification,
} from "@/lib/photo-consent-notifications";
import { isPhotoConsentLevel } from "@/lib/photo-consent-levels";
import { buildPhotoConsentSummary, calculatePhotoConsentAge } from "@/lib/photo-consent-summary";
import {
  MAX_PHOTO_CONSENT_NOTE,
  appendPhotoConsentVersion,
  checkPhotoConsentSubmission,
  parseSignatureInput,
  persistPhotoConsentSubmission,
  type PhotoConsentDocumentInput,
} from "@/lib/photo-consent-submission";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);

type UploadedFile = {
  name?: string | null;
  type?: string | null;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function isFileLike(value: unknown): value is UploadedFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const maybeFile = value as Partial<UploadedFile>;
  return typeof maybeFile.size === "number" && typeof maybeFile.arrayBuffer === "function";
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return value === true;
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

  const [user, show] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        dateOfBirth: true,
        photoConsents: photoConsentsForShow(
          showId,
          {
            id: true,
            status: true,
            level: true,
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
            versions: {
              orderBy: { version: "desc" },
              select: {
                id: true,
                version: true,
                status: true,
                level: true,
                submittedAt: true,
                source: true,
                documentName: true,
                documentUploadedAt: true,
                signatureVersion: true,
                exclusionNote: true,
              },
            },
          },
          { includeRevoked: true },
        ),
      },
    }),
    showId
      ? prisma.show.findUnique({ where: { id: showId }, select: { title: true, year: true } })
      : null,
  ]);

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const consent = firstConsent(user.photoConsents);
  const age = calculatePhotoConsentAge(user.dateOfBirth);
  // Vorausfüllen nur für Volljährige; Minderjährige geben jede Produktion neu ab (E2).
  const previous =
    age !== null && age >= 18 ? await loadPreviousPhotoConsent(userId, showId) : null;

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
      versions: consent?.versions ?? [],
      showTitle: show ? (show.title ?? `Produktion ${show.year}`) : null,
      previous,
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
        level: "none",
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

  const level = body.level;
  if (!isPhotoConsentLevel(level)) {
    return NextResponse.json({ error: "Bitte wähle eine Stufe aus" }, { status: 400 });
  }

  const rawNote = typeof body.exclusionNote === "string" ? body.exclusionNote.trim() : "";
  if (rawNote.length > MAX_PHOTO_CONSENT_NOTE) {
    return NextResponse.json(
      { error: `Bitte kürze deinen Hinweis auf maximal ${MAX_PHOTO_CONSENT_NOTE} Zeichen` },
      { status: 400 },
    );
  }
  const exclusionNote = rawNote ? rawNote : null;

  const showId = await resolvePhotoConsentShowId(userId);
  if (!showId) {
    return NextResponse.json(
      { error: "Du bist aktuell keiner Produktion zugeordnet" },
      { status: 409 },
    );
  }

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
        documentUploadedAt: true,
        signatureCapturedAt: true,
      }),
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const { signature, error: signatureError } = parseSignatureInput(body.signaturePayload);
  if (signatureError) {
    return NextResponse.json({ error: signatureError }, { status: 400 });
  }

  let document: PhotoConsentDocumentInput | null = null;
  const upload = documentFiles[0] ?? null;
  if (upload) {
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
    document = {
      name: sanitizeFilename(upload.name || "einverstaendnis.pdf"),
      mime: mime || "application/octet-stream",
      size: upload.size,
      data: new Uint8Array(await upload.arrayBuffer()),
    };
  }

  const existingConsent = firstConsent(user.photoConsents);
  const age = calculatePhotoConsentAge(user.dateOfBirth);
  const checkError = checkPhotoConsentSubmission({
    level,
    isMinor: age === null ? null : age < 18,
    hasDateOfBirth: Boolean(user.dateOfBirth),
    hasNewProof: Boolean(document || signature),
    hasExistingProof: Boolean(
      existingConsent?.documentUploadedAt || existingConsent?.signatureCapturedAt,
    ),
    deferProof: parseBoolean(body.deferProof),
  });
  if (checkError) {
    return NextResponse.json(
      { error: checkError, requiresDateOfBirth: !user.dateOfBirth },
      { status: 400 },
    );
  }

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

  const { notification } = await prisma.$transaction(async (tx) => {
    const consent = await persistPhotoConsentSubmission(tx, {
      userId,
      showId,
      level,
      exclusionNote,
      // „Gar nicht“ braucht keinen Nachweis; mitgeschickte Daten werden verworfen.
      document: level === "none" ? null : document,
      signature: level === "none" ? null : signature,
      submittedById: userId,
      source: "member",
    });

    const notification = await createPhotoConsentBoardNotification(tx, {
      consentId: consent.id,
      status: consent.status,
      hasDocument: consent.hasProof,
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
