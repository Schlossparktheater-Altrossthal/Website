import type { PhotoConsentStatus } from "@prisma/client";

import { getUserDisplayName } from "@/lib/names";
import { calculatePhotoConsentAge } from "@/lib/photo-consent-summary";
import { prisma } from "@/lib/prisma";

export type PhotoPermission = "allowed" | "restricted" | "forbidden";

export const PHOTO_PERMISSION_LABELS: Record<PhotoPermission, string> = {
  allowed: "Darf fotografiert werden",
  restricted: "Eingeschränkt",
  forbidden: "Nicht fotografieren",
};

export const PHOTO_CONSENT_STATUS_LABELS: Record<PhotoConsentStatus | "none", string> = {
  none: "Fehlt",
  pending: "Ausstehend",
  approved: "Erteilt",
  rejected: "Abgelehnt",
};

export type PhotoConsentOverviewRow = {
  userId: string;
  name: string;
  status: PhotoConsentStatus | "none";
  permission: PhotoPermission;
  exclusionNote: string | null;
  isMinor: boolean;
};

/**
 * Für Fotograf:innen zählt nur eine freigegebene Erlaubnis. Ausstehend, abgelehnt oder
 * fehlend heißt „nicht fotografieren“; Ausschlüsse machen sie „eingeschränkt“.
 */
export function classifyPhotoPermission(
  consent: {
    status: PhotoConsentStatus;
    consentGiven: boolean;
    exclusionNote: string | null;
  } | null,
): PhotoPermission {
  if (!consent || consent.status !== "approved" || !consent.consentGiven) {
    return "forbidden";
  }
  return consent.exclusionNote?.trim() ? "restricted" : "allowed";
}

const PERMISSION_ORDER: PhotoPermission[] = ["forbidden", "restricted", "allowed"];

/** Alle aktiven Mitglieder einer Produktion mit ihrer Fotoerlaubnis für genau diese Produktion. */
export async function loadPhotoConsentOverview(showId: string): Promise<PhotoConsentOverviewRow[]> {
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
            select: { status: true, consentGiven: true, exclusionNote: true },
          },
        },
      },
    },
  });

  return memberships
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
        PERMISSION_ORDER.indexOf(a.permission) - PERMISSION_ORDER.indexOf(b.permission) ||
        a.name.localeCompare(b.name, "de"),
    );
}

function csvCell(value: string): string {
  // Formeln in Tabellenprogrammen verhindern (CSV-Injection).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV für Excel/LibreOffice (Semikolon, UTF-8 mit BOM). */
export function photoConsentOverviewToCsv(rows: readonly PhotoConsentOverviewRow[]): string {
  const header = ["Name", "Fotografieren", "Fotoerlaubnis", "Ausschlüsse", "Minderjährig"];
  const lines = rows.map((row) =>
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
