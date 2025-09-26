"use server";

import { clearImpersonationCookie } from "@/lib/auth/impersonation";
import { requireAuth } from "@/lib/rbac";

export type StopImpersonationResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

export async function stopImpersonationAction(input?: {
  redirectTo?: string | null;
}): Promise<StopImpersonationResult> {
  const redirectTo =
    typeof input?.redirectTo === "string" && input.redirectTo.startsWith("/")
      ? input.redirectTo
      : undefined;

  const session = await requireAuth(undefined, { allowImpersonation: false });
  if (!session?.user?.id) {
    return { ok: false, error: "Anmeldung erforderlich" } as const;
  }

  await clearImpersonationCookie();
  return redirectTo ? { ok: true, redirectTo } : { ok: true };
}
