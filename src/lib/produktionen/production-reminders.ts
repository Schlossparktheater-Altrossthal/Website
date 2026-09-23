import { getAppBaseUrl } from "@/lib/app-url";
import type { MailSender, OutgoingMail } from "@/lib/email/send";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

export type ReminderSummary = { sent: number; noEmail: number; failed: number };

export function buildPhotoConsentReminderMail(input: {
  to: string;
  name: string;
  showTitle: string;
  rejected: boolean;
}): OutgoingMail {
  const link = `${getAppBaseUrl()}/mitglieder/profil`;
  return {
    to: input.to,
    subject: `Fotoerlaubnis für „${input.showTitle}“`,
    text: [
      `Hallo ${input.name},`,
      "",
      input.rejected
        ? `deine Fotoerlaubnis für „${input.showTitle}“ wurde leider abgelehnt. Bitte reiche sie in deinem Profil erneut ein – den Grund findest du dort.`
        : `für „${input.showTitle}“ fehlt noch deine Fotoerlaubnis. Sie gilt pro Produktion, deshalb brauchen wir sie auch von dir, wenn du schon mal dabei warst.`,
      "",
      link,
      "",
      "Solange sie fehlt, wirst du bei Fotos und Videos ausgespart.",
      "",
      "Danke!",
    ].join("\n"),
  };
}

/**
 * Erinnert aktive Mitglieder, deren Fotoerlaubnis für diese Produktion fehlt oder abgelehnt
 * wurde. Ausstehende Erlaubnisse liegen bei der Verwaltung und werden nicht angemahnt.
 */
export async function sendPhotoConsentReminders(input: {
  showId: string;
  sender: MailSender;
}): Promise<ReminderSummary> {
  const show = await prisma.show.findUniqueOrThrow({
    where: { id: input.showId },
    select: { title: true, year: true },
  });
  const showTitle = show.title?.trim() || `Produktion ${show.year}`;

  const memberships = await prisma.productionMembership.findMany({
    where: {
      showId: input.showId,
      status: "active",
      user: {
        deactivatedAt: null,
        photoConsents: {
          none: {
            showId: input.showId,
            revokedAt: null,
            status: { in: ["pending", "approved"] },
          },
        },
      },
    },
    select: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          photoConsents: {
            where: { showId: input.showId, revokedAt: null },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  });

  const summary: ReminderSummary = { sent: 0, noEmail: 0, failed: 0 };
  for (const { user } of memberships) {
    if (!user.email) {
      summary.noEmail += 1;
      continue;
    }
    try {
      await input.sender(
        buildPhotoConsentReminderMail({
          to: user.email,
          name: getUserDisplayName(user, "Mitglied"),
          showTitle,
          rejected: user.photoConsents[0]?.status === "rejected",
        }),
      );
      summary.sent += 1;
    } catch (error) {
      console.error("[photo-consent-reminder] Mail fehlgeschlagen", error);
      summary.failed += 1;
    }
  }
  return summary;
}

/** Mitglieder, die eingeladen sind, ihr Onboarding aber noch nicht abgeschlossen haben. */
export async function findOpenOnboardingUserIds(showId: string): Promise<string[]> {
  const memberships = await prisma.productionMembership.findMany({
    where: { showId, status: { in: ["invited", "onboarding"] } },
    select: { userId: true },
  });
  return memberships.map((membership) => membership.userId);
}

export function formatReminderSummary(summary: ReminderSummary): string {
  const parts = [`${summary.sent} Erinnerungen verschickt`];
  if (summary.noEmail > 0) parts.push(`${summary.noEmail} ohne E-Mail-Adresse`);
  if (summary.failed > 0) parts.push(`${summary.failed} fehlgeschlagen`);
  return `${parts.join(", ")}.`;
}
