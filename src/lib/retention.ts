import { Prisma, type ProductionStatus, type Role } from "@prisma/client";

import { deactivateMemberInAuthentik } from "@/lib/authentik/sync";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

import { isCurrentProductionStatus } from "./produktionen/status";

/** Aufbewahrungsfristen nach Ende der letzten Produktion (Entscheidung E4, 2026-09-24; Konten 3 statt 6 Jahre seit 2026-10-22). */
export const RETENTION_YEARS = {
  dietary: 2,
  measurements: 2,
  photoConsent: 5,
  account: 3,
} as const;

/** Konten mit diesen Rollen werden nie automatisch zum Anonymisieren vorgeschlagen. */
const ACCOUNT_PROTECTED_ROLES: ReadonlySet<Role> = new Set(["board", "finance", "admin", "owner"]);

export function yearsBefore(now: Date, years: number): Date {
  const date = new Date(now);
  date.setFullYear(date.getFullYear() - years);
  return date;
}

type ShowForRetention = { status: ProductionStatus; statusChangedAt: Date | null; year: number };

/** Ende einer Produktion: Statuswechsel auf beendet/archiviert, sonst Jahresende. */
export function productionEndDate(show: ShowForRetention): Date {
  return show.statusChangedAt ?? new Date(Date.UTC(show.year, 11, 31));
}

type MembershipForRetention = {
  status: string;
  joinedAt: Date;
  leftAt: Date | null;
  show: ShowForRetention;
};

/**
 * Letzter Kontakt über eine Produktion. `null`, solange die Person in einer geplanten oder
 * aktiven Produktion ist (dann läuft keine Frist).
 */
export function lastProductionEnd(
  memberships: readonly MembershipForRetention[],
  createdAt: Date,
): Date | null {
  if (
    memberships.some(
      (membership) =>
        membership.status !== "left" && isCurrentProductionStatus(membership.show.status),
    )
  ) {
    return null;
  }
  const ends = memberships.map((membership) => {
    const showEnd = isCurrentProductionStatus(membership.show.status)
      ? membership.joinedAt
      : productionEndDate(membership.show);
    return membership.leftAt && membership.leftAt < showEnd ? membership.leftAt : showEnd;
  });
  return ends.length > 0 ? new Date(Math.max(...ends.map((date) => date.getTime()))) : createdAt;
}

export type RetentionUser = {
  id: string;
  name: string;
  lastEnd: Date;
};

export type RetentionCandidates = {
  dietary: RetentionUser[];
  measurements: RetentionUser[];
  accounts: RetentionUser[];
  photoConsents: Array<{ id: string; userName: string; showTitle: string; showEnd: Date }>;
};

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.name ||
    user.email ||
    "Unbekannt"
  );
}

/** Ermittelt, welche Daten nach den Fristen entfernt werden sollen – ohne etwas zu ändern. */
export async function collectRetentionCandidates(
  now: Date = new Date(),
): Promise<RetentionCandidates> {
  const [users, consents] = await Promise.all([
    prisma.user.findMany({
      where: { anonymizedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        createdAt: true,
        deactivatedAt: true,
        role: true,
        roles: { select: { role: true } },
        productionMemberships: {
          select: {
            status: true,
            joinedAt: true,
            leftAt: true,
            show: { select: { status: true, statusChangedAt: true, year: true } },
          },
        },
        _count: {
          select: {
            dietaryRestrictions: true,
            dietaryAversions: true,
            measurements: true,
            sizes: true,
          },
        },
        onboardingProfile: { select: { dietaryPreference: true } },
      },
    }),
    prisma.photoConsent.findMany({
      where: { show: { status: { in: ["finished", "archived"] } } },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true, name: true, email: true } },
        show: { select: { title: true, year: true, status: true, statusChangedAt: true } },
      },
    }),
  ]);

  const dietaryCutoff = yearsBefore(now, RETENTION_YEARS.dietary);
  const measurementCutoff = yearsBefore(now, RETENTION_YEARS.measurements);
  const accountCutoff = yearsBefore(now, RETENTION_YEARS.account);
  const photoCutoff = yearsBefore(now, RETENTION_YEARS.photoConsent);

  const candidates: RetentionCandidates = {
    dietary: [],
    measurements: [],
    accounts: [],
    photoConsents: [],
  };
  for (const user of users) {
    const lastEnd = lastProductionEnd(user.productionMemberships, user.createdAt);
    if (!lastEnd) continue;
    const entry = { id: user.id, name: displayName(user), lastEnd };
    // Abneigungen sind Ernährungsangaben und laufen in dieselbe Frist wie Allergien.
    const hasDietary =
      user._count.dietaryRestrictions > 0 ||
      user._count.dietaryAversions > 0 ||
      Boolean(user.onboardingProfile?.dietaryPreference);
    if (hasDietary && lastEnd < dietaryCutoff) {
      candidates.dietary.push(entry);
    }
    const hasMeasurements = user._count.measurements > 0 || user._count.sizes > 0;
    if (hasMeasurements && lastEnd < measurementCutoff) {
      candidates.measurements.push(entry);
    }
    const roles = [user.role, ...user.roles.map((entry) => entry.role)];
    const isProtected = roles.some((role) => ACCOUNT_PROTECTED_ROLES.has(role));
    if (user.deactivatedAt && !isProtected && lastEnd < accountCutoff) {
      candidates.accounts.push(entry);
    }
  }
  for (const consent of consents) {
    const showEnd = productionEndDate(consent.show);
    if (showEnd < photoCutoff) {
      candidates.photoConsents.push({
        id: consent.id,
        userName: displayName(consent.user),
        showTitle: consent.show.title?.trim() || `Produktion ${consent.show.year}`,
        showEnd,
      });
    }
  }
  const byDate = (a: { lastEnd: Date }, b: { lastEnd: Date }) =>
    a.lastEnd.getTime() - b.lastEnd.getTime();
  candidates.dietary.sort(byDate);
  candidates.measurements.sort(byDate);
  candidates.accounts.sort(byDate);
  return candidates;
}

/**
 * Entfernt Allergien, Abneigungen und Ernährungsangaben inkl. Kopien in Onboarding-Snapshots und
 * Einreichungen.
 */
export async function purgeDietaryData(userIds: readonly string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const ids = [...userIds];
  await prisma.$transaction([
    prisma.dietaryRestriction.deleteMany({ where: { userId: { in: ids } } }),
    prisma.dietaryAversion.deleteMany({ where: { userId: { in: ids } } }),
    prisma.memberOnboardingProfile.updateMany({
      where: { userId: { in: ids } },
      data: {
        dietaryPreference: null,
        dietaryPreferenceVariant: null,
        dietaryPreferenceStrictness: null,
      },
    }),
    prisma.productionOnboarding.updateMany({
      where: { userId: { in: ids } },
      data: { profileSnapshot: Prisma.DbNull },
    }),
    prisma.memberInviteRedemption.updateMany({
      where: { userId: { in: ids } },
      data: { payload: Prisma.DbNull },
    }),
  ]);
  return ids.length;
}

/** Löscht Körpermaße und Konfektionsgrößen nach Ablauf der Frist. */
export async function purgeMeasurements(userIds: readonly string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const ids = [...userIds];
  await prisma.$transaction([
    prisma.memberMeasurement.deleteMany({ where: { userId: { in: ids } } }),
    prisma.memberSize.deleteMany({ where: { userId: { in: ids } } }),
  ]);
  return ids.length;
}

/** Löscht Fotoerlaubnisse (inkl. Dokumenten) nach Ablauf der Frist. */
export async function purgePhotoConsents(consentIds: readonly string[]): Promise<number> {
  if (consentIds.length === 0) return 0;
  const result = await prisma.photoConsent.deleteMany({ where: { id: { in: [...consentIds] } } });
  return result.count;
}

/**
 * Anonymisiert ein Konto: entfernt Personen-, Gesundheits- und Zahlungsdaten, behält aber die
 * Verknüpfungen (Produktionen, Proben, Finanzbuchungen) für Statistik und Nachvollziehbarkeit.
 */
export async function anonymizeAccount(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.memberMeasurement.deleteMany({ where: { userId } }),
    prisma.memberSize.deleteMany({ where: { userId } }),
    prisma.dietaryRestriction.deleteMany({ where: { userId } }),
    prisma.dietaryAversion.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.calendarFeed.deleteMany({ where: { userId } }),
    prisma.userInterest.deleteMany({ where: { userId } }),
    prisma.memberRolePreference.deleteMany({ where: { userId } }),
    prisma.photoConsent.deleteMany({ where: { userId } }),
    prisma.availability.deleteMany({ where: { userId } }),
    prisma.availabilityDay.deleteMany({ where: { userId } }),
    prisma.availabilityTemplate.deleteMany({ where: { userId } }),
    prisma.blockedDay.deleteMany({ where: { userId } }),
    prisma.memberOnboardingProfile.deleteMany({ where: { userId } }),
    prisma.productionOnboarding.updateMany({
      where: { userId },
      data: { profileSnapshot: Prisma.DbNull },
    }),
    prisma.memberInviteRedemption.updateMany({
      where: { userId },
      data: { email: null, payload: Prisma.DbNull },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        firstName: "Ehemaliges",
        lastName: "Mitglied",
        name: null,
        email: null,
        emailVerified: null,
        passwordHash: null,
        dateOfBirth: null,
        avatarSource: "INITIALS",
        avatarImage: null,
        avatarImageMime: null,
        avatarImageUpdatedAt: null,
        payoutAccountHolder: null,
        payoutIban: null,
        payoutBankName: null,
        payoutPaypalHandle: null,
        payoutNote: null,
        deactivatedAt: now,
        anonymizedAt: now,
        sessionVersion: { increment: 1 },
      },
    }),
  ]);
  // Authentik-Konten werden bewusst nur deaktiviert (andere Dienste hängen daran).
  await deactivateMemberInAuthentik(userId);
}

/**
 * Schalter für die automatische Bereinigung im Cron (docs/Plan/datenschutz-plan.md). Ohne ihn
 * schlägt die Seite „Aufbewahrung“ nur vor.
 */
export function isAutomaticRetentionEnabled(): boolean {
  return process.env.RETENTION_AUTO_ENABLED?.trim() === "true";
}

export type AutomaticRetentionResult = {
  dietary: number;
  measurements: number;
  photoConsents: number;
  accounts: number;
  failedAccounts: number;
};

/**
 * Wendet alle abgelaufenen Fristen an. Idempotent: ein zweiter Lauf findet keine Kandidaten mehr.
 * Konten kommen wie bisher nur in Frage, wenn sie deaktiviert und nicht geschützt sind.
 */
export async function applyRetention(now: Date = new Date()): Promise<AutomaticRetentionResult> {
  const candidates = await collectRetentionCandidates(now);
  const dietary = await purgeDietaryData(candidates.dietary.map((entry) => entry.id));
  const measurements = await purgeMeasurements(candidates.measurements.map((entry) => entry.id));
  const photoConsents = await purgePhotoConsents(candidates.photoConsents.map((entry) => entry.id));
  let accounts = 0;
  let failedAccounts = 0;
  for (const entry of candidates.accounts) {
    try {
      await anonymizeAccount(entry.id, now);
      accounts += 1;
    } catch (error) {
      failedAccounts += 1;
      console.error("[retention] Konto konnte nicht anonymisiert werden", entry.id, error);
    }
  }
  return { dietary, measurements, photoConsents, accounts, failedAccounts };
}

const berlinTime = new Intl.DateTimeFormat("de-DE", {
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Einmal pro Nacht: Der Cron `rehearsal-reminders` läuft alle 15 Minuten, das Fenster 3:00–3:14 trifft genau einen Lauf. */
export function isRetentionWindow(now: Date): boolean {
  const parts = berlinTime.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour === 3 && minute < 15;
}
