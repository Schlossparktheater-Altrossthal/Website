import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { onboardingPathForHash } from "@/lib/member-invite-links";

export const dynamic = "force-dynamic";

export default async function RegieOnboardingInviteShortLinkPage({
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
    select: { tokenHash: true, roles: true },
  });

  if (!invite) {
    notFound();
  }

  redirect(onboardingPathForHash(invite.tokenHash, invite.roles));
}
