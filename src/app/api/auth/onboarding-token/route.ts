import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ONBOARDING_TOKEN_COOKIE,
  ONBOARDING_TOKEN_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/authentik/config";

const requestSchema = z.object({ token: z.string().trim().min(1).max(256) });

/**
 * Merkt sich den Onboarding-Token, sobald die Login-Seite mit Einladung geöffnet
 * wird, in einem kurzlebigen httpOnly-Cookie. Der signIn-Callback in
 * `src/auth.ts` lässt deaktivierte Rückkehrer damit herein, `requireAuth`
 * schickt sie zum Rückkehrer-Onboarding, und "Passwort vergessen" verschickt
 * die Mail auch dann, wenn der Token nicht mitgeschickt wird.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ONBOARDING_TOKEN_COOKIE, parsed.data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONBOARDING_TOKEN_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
