import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp, recordOnboardingEmailCheck } from "@/lib/auth/rate-limit";
import { isInviteUsable } from "@/lib/member-invites";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  sessionToken: z.string().min(16),
  email: z.string().trim().email(),
});

/**
 * Prüft im Onboarding, ob es zur E-Mail schon ein Konto gibt, damit Rückkehrer sich
 * anmelden können statt ein zweites Konto anzulegen. Nur mit gültiger, noch offener
 * Einladungssitzung und rate-limitiert.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { sessionToken } = parsed.data;
  const rateLimit = recordOnboardingEmailCheck(sessionToken, getRequestIp(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen, bitte später erneut versuchen." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const redemption = await prisma.memberInviteRedemption.findUnique({
    where: { sessionToken },
    select: {
      completedAt: true,
      invite: {
        select: { expiresAt: true, maxUses: true, usageCount: true, isDisabled: true },
      },
    },
  });
  if (!redemption || redemption.completedAt || !isInviteUsable(redemption.invite)) {
    return NextResponse.json({ error: "Einladung ist nicht mehr gültig" }, { status: 403 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return NextResponse.json({ known: Boolean(existing) });
}
