import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";

import {
  unsubscribeFromNotificationMails,
  verifyUnsubscribeSignature,
} from "@/lib/email/unsubscribe";

/**
 * Ein-Klick-Abmeldung aus dem Mailprogramm (RFC 8058, `List-Unsubscribe-Post`). Nur POST – ein
 * GET (z. B. Link-Scanner) meldet niemanden ab, sondern leitet auf die Bestätigungsseite.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const signature = url.searchParams.get("s") ?? "";
  if (!userId || !verifyUnsubscribeSignature(userId, signature)) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
  }
  await unsubscribeFromNotificationMails(userId);
  return NextResponse.json({ ok: true });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  // Öffentliche Adresse statt request.url – hinter dem Proxy ist das sonst die Pod-Adresse.
  return NextResponse.redirect(`${getAppBaseUrl()}/email/abmelden${url.search}`, 303);
}
