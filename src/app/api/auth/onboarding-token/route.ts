import { NextResponse } from "next/server";
import { z } from "zod";

import { ONBOARDING_TOKEN_COOKIE } from "@/lib/authentik/config";

const requestSchema = z.object({ token: z.string().trim().min(1).max(256) });

/**
 * Merkt sich den Onboarding-Token vor dem Sprung zu Authentik in einem
 * kurzlebigen httpOnly-Cookie. Der signIn-Callback in `src/auth.ts` prüft ihn
 * und reaktiviert deaktivierte Rückkehrer.
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
    maxAge: 15 * 60,
  });
  return response;
}
