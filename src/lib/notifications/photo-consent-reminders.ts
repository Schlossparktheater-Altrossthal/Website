import { prisma } from "@/lib/prisma";

import { notify } from "./notify";
import { NOTIFICATION_TYPES } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nach diesem Abstand darf dieselbe Person für dieselbe Produktion erneut erinnert werden. */
export const PHOTO_CONSENT_REMINDER_INTERVAL_DAYS = 7;

const GROUP_PREFIX = "photo-consent-reminder";

export type PhotoConsentReminderSummary = {
  sent: number;
  skipped: number;
  failed: number;
};

/** Idempotenz-Schlüssel je Produktion und Person. */
export function photoConsentReminderGroupKey(showId: string, userId: string) {
  return `${GROUP_PREFIX}:${showId}:${userId}`;
}

type MissingConsent = {
  showId: string;
  showTitle: string;
  userId: string;
  rejected: boolean;
};

/**
 * Aktive Mitglieder, deren Fotoerlaubnis für eine laufende/geplante Produktion fehlt oder
 * abgelehnt bzw. widerrufen wurde. Ausstehende Erlaubnisse liegen bei der Verwaltung und werden
 * nicht angemahnt; eine bewusste Ablehnung („gar nicht“) ebenfalls nicht.
 */
async function findMissingPhotoConsents(now: Date): Promise<MissingConsent[]> {
  const shows = await prisma.show.findMany({
    where: { status: { in: ["active", "planning"] } },
    select: { id: true, title: true, year: true },
  });

  const missing: MissingConsent[] = [];
  for (const show of shows) {
    const memberships = await prisma.productionMembership.findMany({
      where: {
        showId: show.id,
        status: "active",
        user: { deactivatedAt: null },
      },
      select: {
        userId: true,
        user: {
          select: {
            photoConsents: {
              where: { showId: show.id },
              take: 1,
              select: { status: true, revokedAt: true },
            },
          },
        },
      },
    });

    for (const membership of memberships) {
      const consent = membership.user.photoConsents[0] ?? null;
      if (consent && !consent.revokedAt && consent.status !== "rejected") {
        continue;
      }
      missing.push({
        showId: show.id,
        showTitle: show.title?.trim() || `Produktion ${show.year}`,
        userId: membership.userId,
        rejected: consent?.status === "rejected",
      });
    }
  }
  return missing;
}

/**
 * Versendet die fälligen Fotoerlaubnis-Erinnerungen als In-App-Benachrichtigung (mit Push).
 * Der Lauf ist idempotent: Wer innerhalb des Intervalls schon erinnert wurde, wird übersprungen.
 */
export async function dispatchPhotoConsentReminders({
  now = new Date(),
}: { now?: Date } = {}): Promise<PhotoConsentReminderSummary> {
  const missing = await findMissingPhotoConsents(now);
  if (missing.length === 0) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const groupKeys = missing.map((candidate) =>
    photoConsentReminderGroupKey(candidate.showId, candidate.userId),
  );
  const cutoff = new Date(now.getTime() - PHOTO_CONSENT_REMINDER_INTERVAL_DAYS * DAY_MS);
  const existing = await prisma.notification.findMany({
    where: {
      type: NOTIFICATION_TYPES.PHOTO_CONSENT,
      groupKey: { in: groupKeys },
      createdAt: { gte: cutoff },
    },
    select: { groupKey: true },
  });
  const reminded = new Set(existing.map((entry) => entry.groupKey).filter(Boolean));

  const pending = missing.filter(
    (candidate) => !reminded.has(photoConsentReminderGroupKey(candidate.showId, candidate.userId)),
  );

  let sent = 0;
  let failed = 0;
  for (const candidate of pending) {
    try {
      await notify({
        type: NOTIFICATION_TYPES.PHOTO_CONSENT,
        recipients: [candidate.userId],
        title: "Fotoerlaubnis fehlt noch",
        body: candidate.rejected
          ? `Deine Fotoerlaubnis für „${candidate.showTitle}“ wurde abgelehnt – bitte reiche sie erneut ein.`
          : `Für „${candidate.showTitle}“ fehlt noch deine Fotoerlaubnis.`,
        actionUrl: "/mitglieder/profil?bereich=freigaben",
        showId: candidate.showId,
        groupKey: photoConsentReminderGroupKey(candidate.showId, candidate.userId),
      });
      sent += 1;
    } catch (error) {
      console.error("[photo-consent-reminders] Versand fehlgeschlagen", error);
      failed += 1;
    }
  }

  return { sent, skipped: missing.length - pending.length, failed };
}
