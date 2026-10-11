import { NextResponse, type NextRequest } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { BOX_OFFICE_COOKIE, findUsableAccess } from "@/lib/karten/access";
import { BOX_OFFICE_PATH } from "@/lib/karten/constants";

export const dynamic = "force-dynamic";

/** Link aus der Zugangs-Mail: setzt das Kartenbüro-Cookie und leitet weiter. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const access = await findUsableAccess(token);
  // Hinter dem Proxy ist request.nextUrl.origin die interne Adresse – öffentliche Basis-URL nutzen.
  const target = new URL(BOX_OFFICE_PATH, getAppBaseUrl());
  if (!access) {
    target.searchParams.set("fehler", "link");
    return NextResponse.redirect(target);
  }
  // Reiner Einlass-Zugang (QR-Code an der Tür): direkt zum Einlass.
  if (!access.canOffice) target.pathname = `${BOX_OFFICE_PATH}/einlass`;
  const response = NextResponse.redirect(target);
  response.cookies.set(BOX_OFFICE_COOKIE, token, {
    httpOnly: true,
    secure: target.protocol === "https:",
    sameSite: "lax",
    path: "/",
    expires: access.expiresAt,
  });
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
