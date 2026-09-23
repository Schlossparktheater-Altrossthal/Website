import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import type { PhotoConsentAdminEntry } from "@/types/photo-consent";
import { combineNameParts, getUserDisplayName } from "@/lib/names";
import {
  createPhotoConsentBoardNotification,
  dispatchPhotoConsentBoardNotification,
} from "@/lib/photo-consent-notifications";
import { signaturePayloadSchema } from "@/types/signature";

type ConsentWithUser = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectionReason: string | null;
  exclusionNote: string | null;
  documentUploadedAt: Date | null;
  documentName: string | null;
  documentMime: string | null;
  signatureVersion: string | null;
  signatureCapturedAt: Date | null;
  signaturePayload: unknown;
  userId: string;
  showId: string;
  show: { title: string | null; year: number };
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
    dateOfBirth: Date | null;
  };
  approvedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  } | null;
};

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

function parseSignaturePayload(value: unknown) {
  if (!value) return null;
  const parsed = signaturePayloadSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function mapConsent(consent: ConsentWithUser): PhotoConsentAdminEntry {
  const dateOfBirth = consent.user.dateOfBirth;
  const age = calculateAge(dateOfBirth);
  const requiresDocument = age !== null && age < 18;
  const requiresDateOfBirth = !dateOfBirth;
  const combinedName =
    combineNameParts(consent.user.firstName, consent.user.lastName) ?? consent.user.name ?? null;
  const approverName = consent.approvedBy
    ? (combineNameParts(consent.approvedBy.firstName, consent.approvedBy.lastName) ??
      consent.approvedBy.name ??
      null)
    : null;
  const documentPreviewUrl =
    consent.documentUploadedAt && consent.documentMime?.toLowerCase().startsWith("image/")
      ? `/api/photo-consents/${consent.id}/document?mode=inline`
      : null;
  const signaturePayload = parseSignaturePayload(consent.signaturePayload);
  const signatureVersion = consent.signatureVersion ?? null;
  const signatureCapturedAt =
    consent.signatureCapturedAt && !Number.isNaN(consent.signatureCapturedAt.valueOf())
      ? consent.signatureCapturedAt.toISOString()
      : null;
  return {
    id: consent.id,
    userId: consent.userId,
    showId: consent.showId,
    showTitle: consent.show.title ?? `Produktion ${consent.show.year}`,
    name: combinedName,
    email: consent.user.email,
    status: consent.status,
    submittedAt: consent.createdAt.toISOString(),
    updatedAt: consent.updatedAt.toISOString(),
    approvedAt: consent.approvedAt ? consent.approvedAt.toISOString() : null,
    approvedByName: approverName,
    rejectionReason: consent.rejectionReason ?? null,
    exclusionNote: consent.exclusionNote ?? null,
    hasDocument: Boolean(consent.documentUploadedAt),
    requiresDocument,
    requiresDateOfBirth,
    dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
    age,
    documentName: consent.documentName ?? null,
    documentUrl: consent.documentUploadedAt ? `/api/photo-consents/${consent.id}/document` : null,
    documentUploadedAt: consent.documentUploadedAt
      ? consent.documentUploadedAt.toISOString()
      : null,
    documentMime: consent.documentMime ?? null,
    documentPreviewUrl,
    signatureVersion,
    signatureCapturedAt,
    signaturePayload,
  };
}

const ALL_PRODUCTIONS = "all";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  // Standard: Fotoerlaubnisse der aktuell ausgewählten Produktion.
  const requestedShowId = request.nextUrl.searchParams.get("showId")?.trim() || null;
  const showId =
    requestedShowId ?? (session.user?.id ? await getActiveProductionId(session.user.id) : null);

  const [consents, shows] = await Promise.all([
    prisma.photoConsent.findMany({
      where: showId && showId !== ALL_PRODUCTIONS ? { showId } : {},
      orderBy: { createdAt: "desc" },
      include: {
        show: { select: { title: true, year: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
            dateOfBirth: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
      },
    }),
    prisma.show.findMany({
      orderBy: [{ year: "desc" }],
      select: { id: true, title: true, year: true, status: true },
    }),
  ]);

  const entries = consents.map((consent) => mapConsent(consent));
  return NextResponse.json({
    entries,
    showId: showId ?? ALL_PRODUCTIONS,
    shows: shows.map((show) => ({
      id: show.id,
      title: show.title ?? `Produktion ${show.year}`,
      year: show.year,
      status: show.status,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const id = "id" in body ? String((body as { id?: unknown }).id ?? "").trim() : "";
  const action = "action" in body ? String((body as { action?: unknown }).action ?? "").trim() : "";
  const reasonRaw = "reason" in body ? (body as { reason?: unknown }).reason : undefined;

  if (!id) {
    return NextResponse.json({ error: "Fehlende ID" }, { status: 400 });
  }

  if (!["approve", "reject", "reset"].includes(action)) {
    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  }

  let rejectionReason: string | null = null;
  if (action === "reject") {
    if (typeof reasonRaw !== "string" || !reasonRaw.trim()) {
      return NextResponse.json({ error: "Bitte gib einen Ablehnungsgrund an" }, { status: 400 });
    }
    rejectionReason = reasonRaw.trim();
  }

  try {
    const updateData: Record<string, unknown> = {};
    const now = new Date();

    if (action === "approve") {
      updateData.status = "approved";
      updateData.approvedAt = now;
      updateData.approvedById = session.user?.id ?? null;
      updateData.rejectionReason = null;
    } else if (action === "reject") {
      updateData.status = "rejected";
      updateData.approvedAt = null;
      updateData.approvedById = null;
      updateData.rejectionReason = rejectionReason;
    } else {
      updateData.status = "pending";
      updateData.approvedAt = null;
      updateData.approvedById = null;
      updateData.rejectionReason = null;
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

    const { entry, notification } = await prisma.$transaction(async (tx) => {
      const updated = await tx.photoConsent.update({
        where: { id },
        data: updateData,
        include: {
          show: { select: { title: true, year: true } },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
              dateOfBirth: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
        },
      });

      const entry = mapConsent(updated);
      const subjectDisplayName = getUserDisplayName(
        {
          firstName: updated.user.firstName,
          lastName: updated.user.lastName,
          name: updated.user.name,
          email: updated.user.email,
        },
        "Unbekanntes Mitglied",
      );

      const notification = await createPhotoConsentBoardNotification(tx, {
        consentId: updated.id,
        status: updated.status,
        hasDocument: Boolean(updated.documentUploadedAt),
        subjectUserId: updated.userId,
        subjectName: subjectDisplayName,
        changeType: "status-changed",
        actorUserId: session.user?.id ?? null,
        actorName: actorDisplayName,
        rejectionReason: updated.rejectionReason ?? null,
      });

      return { entry, notification };
    });

    if (notification) {
      await dispatchPhotoConsentBoardNotification(notification);
    }

    return NextResponse.json({ ok: true, entry });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }
    console.error("[PhotoConsent] Update failed", error);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}
