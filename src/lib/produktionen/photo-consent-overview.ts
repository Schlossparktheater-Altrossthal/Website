import type { PhotoConsentLevel, PhotoConsentStatus } from "@prisma/client";

import {
  PHOTO_PERMISSION_LABELS,
  PHOTO_PERMISSION_ORDER,
  type PhotoPermission,
} from "@/lib/photo-consent-permissions";

import { getUserDisplayName } from "@/lib/names";
import { calculatePhotoConsentAge } from "@/lib/photo-consent-summary";
import { prisma } from "@/lib/prisma";

export {
  PHOTO_PERMISSION_HINTS,
  PHOTO_PERMISSION_LABELS,
  PHOTO_PERMISSION_ORDER,
  PHOTO_PERMISSION_TONES,
  type PhotoPermission,
} from "@/lib/photo-consent-permissions";

export const PHOTO_CONSENT_STATUS_LABELS: Record<PhotoConsentStatus | "none", string> = {
  none: "Fehlt",
  pending: "Ausstehend",
  approved: "Erteilt",
  rejected: "Abgelehnt",
  noPhotos: "Keine Aufnahmen",
};

export type PhotoConsentOverviewRow = {
  userId: string;
  name: string;
  status: PhotoConsentStatus | "none";
  permission: PhotoPermission;
  exclusionNote: string | null;
  isMinor: boolean;
};

export type PhotoConsentOverview = {
  rows: PhotoConsentOverviewRow[];
};

/**
 * Für Fotografen zählt nur eine freigegebene Erlaubnis mit ihrer Stufe. „Gar nicht“ ist ohne
 * Freigabe wirksam; alles andere ohne Freigabe heißt „nicht fotografieren“.
 */
export function classifyPhotoPermission(
  consent: { status: PhotoConsentStatus; level: PhotoConsentLevel | null } | null,
): PhotoPermission {
  if (!consent) return "missing";
  if (consent.status === "noPhotos" || consent.level === "none") return "none";
  if (consent.status !== "approved") return "missing";
  return consent.level ?? "unknown";
}

/** Alle aktiven Mitglieder einer Produktion mit ihrer Fotoerlaubnis für genau diese Produktion. */
export async function loadPhotoConsentOverview(showId: string): Promise<PhotoConsentOverview> {
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
          photoConsents: {
            where: { showId, revokedAt: null },
            take: 1,
            select: { status: true, level: true, exclusionNote: true },
          },
        },
      },
    },
  });

  const rows = memberships
    .map(({ user }) => {
      const consent = user.photoConsents[0] ?? null;
      const age = calculatePhotoConsentAge(user.dateOfBirth);
      return {
        userId: user.id,
        name: getUserDisplayName(user, "Unbekanntes Mitglied"),
        status: consent?.status ?? "none",
        permission: classifyPhotoPermission(consent),
        exclusionNote: consent?.exclusionNote?.trim() || null,
        isMinor: age !== null && age < 18,
      } satisfies PhotoConsentOverviewRow;
    })
    .sort(
      (a, b) =>
        PHOTO_PERMISSION_ORDER.indexOf(a.permission) -
          PHOTO_PERMISSION_ORDER.indexOf(b.permission) || a.name.localeCompare(b.name, "de"),
    );

  return { rows };
}

function csvCell(value: string): string {
  // Formeln in Tabellenprogrammen verhindern (CSV-Injection).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV für Excel/LibreOffice (Semikolon, UTF-8 mit BOM). */
export function photoConsentOverviewToCsv(overview: PhotoConsentOverview): string {
  const header = ["Name", "Fotografieren", "Fotoerlaubnis", "Hinweis", "Minderjährig"];
  const lines = overview.rows.map((row) =>
    [
      row.name,
      PHOTO_PERMISSION_LABELS[row.permission],
      PHOTO_CONSENT_STATUS_LABELS[row.status],
      row.exclusionNote ?? "",
      row.isMinor ? "ja" : "nein",
    ]
      .map(csvCell)
      .join(";"),
  );
  return `﻿${[header.map(csvCell).join(";"), ...lines].join("\r\n")}\r\n`;
}
