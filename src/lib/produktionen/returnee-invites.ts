import type { Role } from "@prisma/client";

import { getAppBaseUrl } from "@/lib/app-url";
import type { MailSender, OutgoingMail } from "@/lib/email/send";
import { generateInviteToken, hashInviteToken } from "@/lib/member-invites";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

import { sanitizeProductionRoles } from "./production-role-keys";

export const RETURNEE_INVITE_VALID_DAYS = 30;

export type ReturneeInviteOutcome = {
  userId: string;
  name: string;
  status: "sent" | "link-only" | "no-email" | "failed";
  link: string | null;
};

export function buildReturneeInviteMail(input: {
  to: string;
  name: string;
  showTitle: string;
  link: string;
  expiresAt: Date;
}): OutgoingMail {
  const expires = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(input.expiresAt);
  return {
    to: input.to,
    subject: `Bist du bei „${input.showTitle}“ wieder dabei?`,
    text: [
      `Hallo ${input.name},`,
      "",
      `wir planen „${input.showTitle}“ und würden uns freuen, wenn du wieder dabei bist.`,
      "Über deinen persönlichen Link meldest du dich mit deinem bisherigen Konto an. Deine Angaben",
      "(z. B. Allergien und Ernährung) sind schon ausgefüllt – du musst sie nur prüfen. Die",
      "Fotoerlaubnis gibst du für jede Produktion neu.",
      "",
      input.link,
      "",
      `Der Link ist bis zum ${expires} gültig und nur für dich bestimmt.`,
      "",
      "Bis bald im Theater!",
    ].join("\n"),
  };
}

/**
 * Lädt ehemalige Mitglieder zu einer Produktion ein: persönliche Einladung (einmal nutzbar),
 * Mitgliedschaft „eingeladen“ und – falls SMTP konfiguriert ist – eine Mail mit dem Link.
 */
export async function inviteFormerMembers(input: {
  showId: string;
  userIds: readonly string[];
  createdById: string;
  sender: MailSender | null;
  now?: Date;
}): Promise<ReturneeInviteOutcome[]> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + RETURNEE_INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);
  const show = await prisma.show.findUniqueOrThrow({
    where: { id: input.showId },
    select: { id: true, title: true, year: true },
  });
  const showTitle = show.title?.trim() || `Produktion ${show.year}`;

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(input.userIds)) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      productionMemberships: {
        where: { showId: { not: input.showId } },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { roles: true },
      },
    },
  });

  const outcomes: ReturneeInviteOutcome[] = [];
  for (const user of users) {
    const name = getUserDisplayName(user, "Mitglied");
    const token = generateInviteToken();
    const roles: Role[] = [
      "member",
      ...sanitizeProductionRoles(user.productionMemberships[0]?.roles ?? []),
    ];
    const link = `${getAppBaseUrl()}/onboarding/${encodeURIComponent(token)}/update`;

    await prisma.$transaction([
      prisma.memberInvite.create({
        data: {
          tokenHash: hashInviteToken(token),
          label: `Rückkehr: ${name}`,
          note: `Persönliche Einladung für ${showTitle}`,
          expiresAt,
          maxUses: 1,
          roles,
          showId: show.id,
          createdById: input.createdById,
        },
      }),
      prisma.productionMembership.upsert({
        where: { showId_userId: { showId: show.id, userId: user.id } },
        update: { status: "invited", leftAt: null },
        create: { showId: show.id, userId: user.id, status: "invited" },
      }),
    ]);

    if (!user.email) {
      outcomes.push({ userId: user.id, name, status: "no-email", link });
      continue;
    }
    if (!input.sender) {
      outcomes.push({ userId: user.id, name, status: "link-only", link });
      continue;
    }
    try {
      await input.sender(
        buildReturneeInviteMail({ to: user.email, name, showTitle, link, expiresAt }),
      );
      outcomes.push({ userId: user.id, name, status: "sent", link: null });
    } catch (error) {
      console.error("[returnee-invite] Mail fehlgeschlagen", error);
      outcomes.push({ userId: user.id, name, status: "failed", link });
    }
  }
  return outcomes;
}
