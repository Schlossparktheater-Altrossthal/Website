import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnboardingInviteShortLinkPage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const resolvedParams = await params;
  const rawInviteId = resolvedParams?.inviteId;
  if (!rawInviteId || typeof rawInviteId !== "string") {
    notFound();
  }

  const inviteId = decodeURIComponent(rawInviteId.trim());
  if (!inviteId) {
    notFound();
  }

  if (!/^c[a-z0-9]{24}$/i.test(inviteId)) {
    notFound();
  }

  const invite = await prisma.memberInvite.findUnique({
    where: { id: inviteId },
    select: { tokenHash: true },
  });

  if (!invite) {
    notFound();
  }

  redirect(`/onboarding/${invite.tokenHash}`);
}
