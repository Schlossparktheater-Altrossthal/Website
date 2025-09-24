import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { calculateInviteStatus, generateInviteToken, hashInviteToken } from "@/lib/member-invites";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const rawToken = resolvedParams?.token;
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 10) {
    notFound();
  }

  const token = decodeURIComponent(rawToken.trim());
  if (!token) {
    notFound();
  }

  const isHashedToken = /^[0-9a-f]{64}$/i.test(token);
  const tokenHash = isHashedToken ? token.toLowerCase() : hashInviteToken(token);
  const invite = await prisma.memberInvite.findUnique({
    where: { tokenHash },
    include: {
      createdBy: { select: { name: true, email: true } },
      show: { select: { id: true, title: true, year: true } },
    },
  });

  if (!invite) {
    return (
      <main id="main" className="mx-auto max-w-3xl space-y-6 py-16 text-center">
        <h1 className="text-3xl font-semibold">Einladung nicht gefunden</h1>
        <p className="text-muted-foreground">
          Dieser Einladungslink ist nicht gültig oder wurde bereits entfernt. Bitte wende dich an die Theaterleitung für einen
          neuen Link.
        </p>
      </main>
    );
  }

  const status = calculateInviteStatus(invite);
  if (!status.isActive) {
    return (
      <main id="main" className="mx-auto max-w-3xl space-y-6 py-16 text-center">
        <h1 className="text-3xl font-semibold">Einladung nicht mehr aktiv</h1>
        <p className="text-muted-foreground">
          Diese Einladung kann nicht mehr verwendet werden. Sie ist entweder abgelaufen, deaktiviert oder es wurden alle Plätze
          genutzt.
        </p>
      </main>
    );
  }

  const sessionToken = generateInviteToken(32);
  const redemption = await prisma.memberInviteRedemption.create({
    data: {
      inviteId: invite.id,
      sessionToken,
    },
  });

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <OnboardingWizard
        sessionToken={redemption.sessionToken}
        invite={{
          label: invite.label,
          note: invite.note,
          roles: invite.roles,
          createdAt: invite.createdAt.toISOString(),
          createdBy: invite.createdBy?.name ?? invite.createdBy?.email ?? null,
          expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
          usageCount: invite.usageCount,
          remainingUses: status.remainingUses,
          production: invite.show,
        }}
      />
    </main>
  );
}
