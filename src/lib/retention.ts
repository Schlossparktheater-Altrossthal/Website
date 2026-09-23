import { Prisma, type ProductionStatus, type Role } from "@prisma/client";

import { deactivateMemberInAuthentik } from "@/lib/authentik/sync";
import { prisma } from "@/lib/prisma";

import { isCurrentProductionStatus } from "./produktionen/status";

/** Aufbewahrungsfristen nach Ende der letzten Produktion (Entscheidung E4, 2026-09-24). */
export const RETENTION_YEARS = {
  dietary: 2,
  photoConsent: 5,
  account: 6,
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
        _count: { select: { dietaryRestrictions: true } },
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
  const accountCutoff = yearsBefore(now, RETENTION_YEARS.account);
  const photoCutoff = yearsBefore(now, RETENTION_YEARS.photoConsent);

  const candidates: RetentionCandidates = { dietary: [], accounts: [], photoConsents: [] };
  for (const user of users) {
    const lastEnd = lastProductionEnd(user.productionMemberships, user.createdAt);
    if (!lastEnd) continue;
    const entry = { id: user.id, name: displayName(user), lastEnd };
    const hasDietary =
      user._count.dietaryRestrictions > 0 || Boolean(user.onboardingProfile?.dietaryPreference);
    if (hasDietary && lastEnd < dietaryCutoff) {
      candidates.dietary.push(entry);
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
  candidates.accounts.sort(byDate);
  return candidates;
}

/** Entfernt Allergien/Ernährungsangaben inkl. Kopien in Onboarding-Snapshots und Einreichungen. */
export async function purgeDietaryData(userIds: readonly string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const ids = [...userIds];
  await prisma.$transaction([
    prisma.dietaryRestriction.deleteMany({ where: { userId: { in: ids } } }),
    prisma.memberOnboardingProfile.updateMany({
      where: { userId: { in: ids } },
      data: { dietaryPreference: null, dietaryPreferenceStrictness: null },
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
