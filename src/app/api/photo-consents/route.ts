import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { getUserDisplayName } from "@/lib/names";
import {
  createPhotoConsentBoardNotification,
  dispatchPhotoConsentBoardNotification,
} from "@/lib/photo-consent-notifications";
import type { PhotoConsentSummary } from "@/types/photo-consent";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

type ConsentRecord = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectionReason: string | null;
  documentUploadedAt: Date | null;
  documentName: string | null;
  approvedBy: { name: string | null } | null;
};

type UserRecord = {
  dateOfBirth: Date | null;
  photoConsent: ConsentRecord | null;
};

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
  return (
    typeof maybeFile.size === "number" &&
    typeof maybeFile.arrayBuffer === "function"
  );
}

function calculateAge(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function buildSummary(user: UserRecord): PhotoConsentSummary {
  const consent = user.photoConsent;
  const dateOfBirth = user.dateOfBirth;
  const age = calculateAge(dateOfBirth);
  const requiresDocument = age !== null && age < 18;
  const requiresDateOfBirth = !dateOfBirth;

  const status: PhotoConsentSummary["status"] = consent?.status ?? "none";

  return {
    status,
    requiresDocument,
    hasDocument: Boolean(consent?.documentUploadedAt),
    submittedAt: consent ? consent.createdAt.toISOString() : null,
    updatedAt: consent ? consent.updatedAt.toISOString() : null,
    approvedAt: consent?.approvedAt ? consent.approvedAt.toISOString() : null,
    approvedByName: consent?.approvedBy?.name ?? null,
    rejectionReason: consent?.rejectionReason ?? null,
    requiresDateOfBirth,
    age,
    dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
    documentName: consent?.documentName ?? null,
    documentUploadedAt: consent?.documentUploadedAt ? consent.documentUploadedAt.toISOString() : null,
  };
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      dateOfBirth: true,
      photoConsent: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          approvedAt: true,
          rejectionReason: true,
          documentUploadedAt: true,
          documentName: true,
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ consent: buildSummary(user) });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> | null = null;
  let documentFile: UploadedFile | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const parsed: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (isFileLike(value)) {
        if (key === "document" && value.size > 0) {
          documentFile = value;
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

  if (!parseBoolean(body.confirm)) {
    return NextResponse.json({ error: "Bitte bestätige dein Einverständnis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      dateOfBirth: true,
      photoConsent: {
        select: {
          id: true,
          status: true,
          documentUploadedAt: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const requiresDateOfBirth = !user.dateOfBirth;
  if (requiresDateOfBirth) {
    return NextResponse.json(
      { error: "Bitte hinterlege zuerst dein Geburtsdatum im Profil", requiresDateOfBirth: true },
      { status: 400 },
    );
  }

  const age = calculateAge(user.dateOfBirth);
  const requiresDocument = age !== null && age < 18;

  if (requiresDocument && !documentFile && !user.photoConsent?.documentUploadedAt) {
    return NextResponse.json({ error: "Bitte lade die unterschriebene Einverständniserklärung hoch" }, { status: 400 });
  }

  let documentBuffer: Buffer | undefined;
  let documentMime: string | undefined;
  let documentName: string | undefined;
  let documentSize: number | undefined;

  const file: UploadedFile | null = documentFile;

  if (file) {
    const upload = file as UploadedFile;
    if (upload.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dokument darf maximal 8 MB groß sein" }, { status: 400 });
    }
    const mime = upload.type?.toLowerCase() ?? "";
    if (mime && !ALLOWED_DOCUMENT_TYPES.has(mime)) {
      return NextResponse.json({ error: "Erlaubt sind PDF oder Bilddateien (JPG, PNG)" }, { status: 400 });
    }
    const buffer = Buffer.from(await upload.arrayBuffer());
    documentBuffer = buffer;
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
    {
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
    },
    "Unbekanntes Mitglied",
  );

  const { consent, notification } = await prisma.$transaction(async (tx) => {
    const consent = await tx.photoConsent.upsert({
      where: { userId },
      create: {
        userId,
        status: "pending",
        consentGiven: true,
        approvedAt: null,
        approvedById: null,
        rejectionReason: null,
        ...docData,
      },
      update: {
        status: "pending",
        consentGiven: true,
        approvedAt: null,
        approvedById: null,
        rejectionReason: null,
        ...(documentBuffer ? docData : {}),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        rejectionReason: true,
        documentUploadedAt: true,
        documentName: true,
        approvedBy: { select: { name: true } },
      },
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
      rejectionReason: consent.rejectionReason ?? null,
    });

    return { consent, notification };
  });

  if (notification) {
    await dispatchPhotoConsentBoardNotification(notification);
  }

  const summary = buildSummary({
    dateOfBirth: user.dateOfBirth,
    photoConsent: consent,
  });

  return NextResponse.json({ ok: true, consent: summary });
}
