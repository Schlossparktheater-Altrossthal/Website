import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import type { PhotoConsentAdminEntry, PhotoConsentMissingEntry } from "@/types/photo-consent";
import { combineNameParts, getUserDisplayName } from "@/lib/names";
import {
  createPhotoConsentBoardNotification,
  dispatchPhotoConsentBoardNotification,
} from "@/lib/photo-consent-notifications";
import { isPhotoConsentLevel, type PhotoConsentLevelValue } from "@/lib/photo-consent-levels";
import {
  buildPhotoConsentVersionViews,
  calculatePhotoConsentAge,
  parseSignaturePayload,
} from "@/lib/photo-consent-summary";

type ConsentWithUser = {
  id: string;
  status: "pending" | "approved" | "rejected" | "noPhotos";
  level: PhotoConsentLevelValue | null;
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
  versions: Array<{
    id: string;
    version: number;
    status: "pending" | "approved" | "rejected" | "noPhotos";
    level: PhotoConsentLevelValue | null;
    submittedAt: Date;
    source: string;
    documentName: string | null;
    documentUploadedAt: Date | null;
    signatureVersion: string | null;
    exclusionNote: string | null;
  }>;
};

function mapConsent(consent: ConsentWithUser): PhotoConsentAdminEntry {
  const dateOfBirth = consent.user.dateOfBirth;
  const age = calculatePhotoConsentAge(dateOfBirth);
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
    level: consent.level,
    submittedAt: consent.createdAt.toISOString(),
    updatedAt: consent.updatedAt.toISOString(),
    approvedAt: consent.approvedAt ? consent.approvedAt.toISOString() : null,
    approvedByName: approverName,
    rejectionReason: consent.rejectionReason ?? null,
    exclusionNote: consent.exclusionNote ?? null,
    hasDocument: Boolean(consent.documentUploadedAt),
    hasProof: Boolean(consent.documentUploadedAt) || Boolean(signaturePayload),
    requiresDocument,
    requiresDateOfBirth,
    isMinor: requiresDocument,
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
    versions: buildPhotoConsentVersionViews(consent.versions),
  };
}

const ALL_PRODUCTIONS = "all";

/** Aktive Mitglieder der Produktion ohne Fotoerlaubnis (Gruppe „Nicht abgegeben“). */
async function loadMissingMembers(
  showId: string,
  consents: ReadonlyArray<{ userId: string }>,
): Promise<PhotoConsentMissingEntry[]> {
  const withConsent = new Set(consents.map((consent) => consent.userId));
  const memberships = await prisma.productionMembership.findMany({
    where: { showId, status: "active" },
    select: {
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
    },
  });
  return memberships
    .filter(({ user }) => !withConsent.has(user.id))
    .map(({ user }) => {
      const age = calculatePhotoConsentAge(user.dateOfBirth);
      return {
        userId: user.id,
        name: getUserDisplayName(user, "Unbekanntes Mitglied"),
        email: user.email,
        isMinor: age !== null && age < 18,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

const CONSENT_INCLUDE = {
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
    select: { id: true, firstName: true, lastName: true, name: true },
  },
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
} satisfies Prisma.PhotoConsentInclude;

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
      include: CONSENT_INCLUDE,
    }),
    prisma.show.findMany({
      orderBy: [{ year: "desc" }],
      select: { id: true, title: true, year: true, status: true },
    }),
  ]);

  const entries = consents.map(mapConsent);
  const missing =
    showId && showId !== ALL_PRODUCTIONS ? await loadMissingMembers(showId, consents) : [];

  return NextResponse.json({
    entries,
    missing,
    showId: showId ?? ALL_PRODUCTIONS,
    shows: shows.map((show) => ({
      id: show.id,
      title: show.title ?? `Produktion ${show.year}`,
      year: show.year,
      status: show.status,
    })),
  });
}

type AdminAction = "approve" | "reject" | "reset" | "setLevel";

const ADMIN_ACTIONS: readonly AdminAction[] = ["approve", "reject", "reset", "setLevel"];

function isAdminAction(value: string): value is AdminAction {
  return (ADMIN_ACTIONS as readonly string[]).includes(value);
}

function parseIds(body: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  if (typeof body.id === "string" && body.id.trim()) {
    ids.add(body.id.trim());
  }
  if (Array.isArray(body.ids)) {
    for (const value of body.ids) {
      if (typeof value === "string" && value.trim()) {
        ids.add(value.trim());
      }
    }
  }
  return Array.from(ids);
}

/**
 * Aktionen der Verwaltung: freigeben (auch mehrere über `ids`), ablehnen, zurücksetzen und die
 * Stufe nachtragen (Altbestand, abgelesen vom Papierformular).
 */
export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const ids = parseIds(body);
  const action = typeof body.action === "string" ? body.action.trim() : "";

  if (ids.length === 0) {
    return NextResponse.json({ error: "Fehlende ID" }, { status: 400 });
  }
  if (!isAdminAction(action)) {
    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  }
  if (ids.length > 1 && action !== "approve") {
    return NextResponse.json(
      { error: "Nur Freigaben sind für mehrere Einträge möglich" },
      { status: 400 },
    );
  }

  let rejectionReason: string | null = null;
  if (action === "reject") {
    if (typeof body.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json({ error: "Bitte gib einen Ablehnungsgrund an" }, { status: 400 });
    }
    rejectionReason = body.reason.trim();
  }

  let level: PhotoConsentLevelValue | null = null;
  if (action === "setLevel" || body.level !== undefined) {
    if (!isPhotoConsentLevel(body.level)) {
      return NextResponse.json({ error: "Bitte wähle eine Stufe aus" }, { status: 400 });
    }
    level = body.level;
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

  const current = await prisma.photoConsent.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      level: true,
      documentUploadedAt: true,
      signatureCapturedAt: true,
    },
  });
  if (current.length !== ids.length) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  if (action === "approve") {
    const blocked = current.find((consent) => {
      const effectiveLevel = level ?? consent.level;
      const hasProof = Boolean(consent.documentUploadedAt || consent.signatureCapturedAt);
      return !effectiveLevel || (effectiveLevel !== "none" && !hasProof);
    });
    if (blocked) {
      return NextResponse.json(
        {
          error:
            ids.length > 1
              ? "Einige Einträge haben keine Stufe oder keinen Nachweis"
              : "Freigabe braucht eine Stufe und einen Nachweis",
        },
        { status: 400 },
      );
    }
  }

  const now = new Date();

  try {
    const results = await prisma.$transaction(async (tx) => {
      const updatedEntries: ConsentWithUser[] = [];
      const notifications = [];

      for (const consent of current) {
        const updateData: Prisma.PhotoConsentUpdateInput = {};
        if (level) {
          updateData.level = level;
        }

        if (action === "approve") {
          // „Gar nicht“ bleibt als eigener Zustand bestehen, er braucht keine Freigabe.
          updateData.status = (level ?? consent.level) === "none" ? "noPhotos" : "approved";
          updateData.approvedAt = now;
          updateData.approvedBy = session.user?.id
            ? { connect: { id: session.user.id } }
            : { disconnect: true };
          updateData.rejectionReason = null;
        } else if (action === "reject") {
          updateData.status = "rejected";
          updateData.approvedAt = null;
          updateData.approvedBy = { disconnect: true };
          updateData.rejectionReason = rejectionReason;
        } else if (action === "setLevel") {
          if (level === "none") {
            updateData.status = "noPhotos";
          } else if (consent.status === "noPhotos") {
            updateData.status = "pending";
          }
        } else {
          // Zurücksetzen leert den eingereichten Nachweis, damit neu eingereicht werden kann.
          updateData.status = "pending";
          updateData.approvedAt = null;
          updateData.approvedBy = { disconnect: true };
          updateData.rejectionReason = null;
          updateData.documentName = null;
          updateData.documentMime = null;
          updateData.documentSize = null;
          updateData.documentUploadedAt = null;
          updateData.documentData = null;
          updateData.signatureVersion = null;
          updateData.signaturePayload = Prisma.JsonNull;
          updateData.signatureCapturedAt = null;
        }

        const updated = await tx.photoConsent.update({
          where: { id: consent.id },
          data: updateData,
          include: CONSENT_INCLUDE,
        });
        updatedEntries.push(updated);

        if (action === "setLevel") {
          continue;
        }

        const subjectDisplayName = getUserDisplayName(
          {
            firstName: updated.user.firstName,
            lastName: updated.user.lastName,
            name: updated.user.name,
            email: updated.user.email,
          },
          "Unbekanntes Mitglied",
        );

        notifications.push(
          await createPhotoConsentBoardNotification(tx, {
            consentId: updated.id,
            status: updated.status,
            hasDocument: Boolean(updated.documentUploadedAt || updated.signatureCapturedAt),
            subjectUserId: updated.userId,
            subjectName: subjectDisplayName,
            changeType: "status-changed",
            actorUserId: session.user?.id ?? null,
            actorName: actorDisplayName,
            rejectionReason: updated.rejectionReason ?? null,
          }),
        );
      }

      return { updatedEntries, notifications };
    });

    for (const notification of results.notifications) {
      if (notification) {
        await dispatchPhotoConsentBoardNotification(notification);
      }
    }

    const entries = results.updatedEntries.map(mapConsent);
    return NextResponse.json({ ok: true, entry: entries[0] ?? null, entries });
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
