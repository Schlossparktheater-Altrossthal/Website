import { NextResponse, type NextRequest } from "next/server";

import { BOX_OFFICE_COOKIE, findUsableAccess } from "@/lib/karten/access";
import { BOX_OFFICE_PATH } from "@/lib/karten/constants";

export const dynamic = "force-dynamic";

/** Link aus der Zugangs-Mail: setzt das Kartenbüro-Cookie und leitet weiter. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const access = await findUsableAccess(token);
  const target = new URL(BOX_OFFICE_PATH, request.nextUrl.origin);
  if (!access) {
    target.searchParams.set("fehler", "link");
    return NextResponse.redirect(target);
  }
  const response = NextResponse.redirect(target);
  response.cookies.set(BOX_OFFICE_COOKIE, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    expires: access.expiresAt,
  });
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
