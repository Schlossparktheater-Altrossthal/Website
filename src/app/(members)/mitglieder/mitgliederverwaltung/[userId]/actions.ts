"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { clearImpersonationCookie, setImpersonationCookie } from "@/lib/auth/impersonation";

const DEFAULT_REDIRECT = "/";

export type StartImpersonationResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export async function startImpersonationAction(input: {
  targetUserId: string;
  redirectTo?: string | null;
}): Promise<StartImpersonationResult> {
  const targetUserId = input?.targetUserId?.trim();
  const redirectTo =
    typeof input?.redirectTo === "string" && input.redirectTo.startsWith("/")
      ? input.redirectTo
      : DEFAULT_REDIRECT;

  if (!targetUserId) {
    return { ok: false, error: "Ungültige Auswahl" } as const;
  }

  const session = await requireAuth(["owner"], { allowImpersonation: false });
  const ownerId = session.user?.id;

  if (!ownerId) {
    return { ok: false, error: "Sitzung konnte nicht geprüft werden" } as const;
  }

  if (targetUserId === ownerId) {
    await clearImpersonationCookie();
    return { ok: true, redirectTo } as const;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!target) {
    return { ok: false, error: "Mitglied wurde nicht gefunden" } as const;
  }

  await setImpersonationCookie(ownerId, target.id);
  return { ok: true, redirectTo } as const;
}
