import { NextResponse, type NextRequest } from "next/server";

export const MEMBERS_PATHNAME_HEADER = "x-members-pathname";

/**
 * Reicht den angefragten Pfad an das Mitglieder-Layout weiter, damit es in der
 * Seitensteuerung ausgeblendete Seiten serverseitig sperren kann.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(MEMBERS_PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/mitglieder", "/mitglieder/:path*"],
};
