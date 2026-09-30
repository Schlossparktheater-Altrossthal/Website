import type { PhotoConsentStatus } from "@prisma/client";

import { getUserDisplayName } from "@/lib/names";
import { calculatePhotoConsentAge } from "@/lib/photo-consent-summary";
import { ensurePhotoConsentPurposes } from "@/lib/photo-consent-purposes";
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
  noPhotos: "Keine Aufnahmen",
};

export type PhotoConsentOverviewRow = {
  userId: string;
  name: string;
  status: PhotoConsentStatus | "none";
  permission: PhotoPermission;
  exclusionNote: string | null;
  isMinor: boolean;
  /** Alle Zwecke des Katalogs mit ihrem Zustand für diese Person (Katalogreihenfolge). */
  purposes: Array<{ label: string; chosen: boolean }>;
};

export type PhotoConsentOverview = {
  /** Labels der Zwecke in Katalogreihenfolge (Spalten der Tabelle). */
  purposes: string[];
  rows: PhotoConsentOverviewRow[];
};

/**
 * Für Fotograf:innen zählt nur eine freigegebene Erlaubnis. Ausstehend, abgelehnt oder
 * fehlend heißt „nicht fotografieren“; Ausschlüsse machen sie „eingeschränkt“.
 */
export function classifyPhotoPermission(
  consent: {
    status: PhotoConsentStatus;
    exclusionNote: string | null;
  } | null,
): PhotoPermission {
  if (!consent || consent.status !== "approved") {
    return "forbidden";
  }
  return consent.exclusionNote?.trim() ? "restricted" : "allowed";
}

const PERMISSION_ORDER: PhotoPermission[] = ["forbidden", "restricted", "allowed"];

/** Alle aktiven Mitglieder einer Produktion mit ihrer Fotoerlaubnis für genau diese Produktion. */
export async function loadPhotoConsentOverview(showId: string): Promise<PhotoConsentOverview> {
  await ensurePhotoConsentPurposes(showId);

  const [memberships, purposeRows] = await Promise.all([
    prisma.productionMembership.findMany({
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
              select: {
                status: true,
                exclusionNote: true,
                choices: { select: { purposeId: true, chosen: true } },
              },
            },
          },
        },
      },
    }),
    prisma.photoConsentPurpose.findMany({
      where: { showId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true },
    }),
  ]);

  const purposes = purposeRows.map((purpose) => purpose.label);

  const rows = memberships
    .map(({ user }) => {
      const consent = user.photoConsents[0] ?? null;
      const age = calculatePhotoConsentAge(user.dateOfBirth);
      const chosenByPurpose = new Map(
        (consent?.choices ?? []).map((choice) => [choice.purposeId, choice.chosen]),
      );
      const purposeState = purposeRows.map((purpose) => ({
        label: purpose.label,
        chosen: chosenByPurpose.get(purpose.id) ?? false,
      }));
      return {
        userId: user.id,
        name: getUserDisplayName(user, "Unbekanntes Mitglied"),
        status: consent?.status ?? "none",
        permission: classifyPhotoPermission(consent),
        exclusionNote: consent?.exclusionNote?.trim() || null,
        isMinor: age !== null && age < 18,
        purposes: purposeState,
      } satisfies PhotoConsentOverviewRow;
    })
    .sort(
      (a, b) =>
        PERMISSION_ORDER.indexOf(a.permission) - PERMISSION_ORDER.indexOf(b.permission) ||
        a.name.localeCompare(b.name, "de"),
    );

  return { purposes, rows };
}

function csvCell(value: string): string {
  // Formeln in Tabellenprogrammen verhindern (CSV-Injection).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV für Excel/LibreOffice (Semikolon, UTF-8 mit BOM). Eine Spalte je Zweck. */
export function photoConsentOverviewToCsv(overview: PhotoConsentOverview): string {
  const header = [
    "Name",
    "Fotografieren",
    "Fotoerlaubnis",
    ...overview.purposes,
    "Ausschlüsse",
    "Minderjährig",
  ];
  const lines = overview.rows.map((row) => {
    const purposeCells = overview.purposes.map((purposeLabel) => {
      const state = row.purposes.find((purpose) => purpose.label === purposeLabel);
      return state?.chosen ? "ja" : "";
    });
    return [
      row.name,
      PHOTO_PERMISSION_LABELS[row.permission],
      PHOTO_CONSENT_STATUS_LABELS[row.status],
      ...purposeCells,
      row.exclusionNote ?? "",
      row.isMinor ? "ja" : "nein",
    ]
      .map(csvCell)
      .join(";");
  });
  return `﻿${[header.map(csvCell).join(";"), ...lines].join("\r\n")}\r\n`;
}
