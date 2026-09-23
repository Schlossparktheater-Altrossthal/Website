import { NextResponse, type NextRequest } from "next/server";

import { getGravatarUrl } from "@/lib/gravatar";
import { getNameInitials, getUserDisplayName } from "@/lib/names";
import { getSession } from "@/lib/rbac";

// Öffentliche Schnittstelle für die Drupal-Website (sommertheater-altrossthal.de):
// Sie fragt im Browser ab, ob jemand im Mitgliederbereich angemeldet ist, und zeigt
// dann den Avatar statt "Anmelden". Die Seiten bleiben so für alle gleich cachebar.
// Hauptdomain und app.* sind dieselbe "Site", deshalb schickt der Browser das
// SameSite=Lax-Session-Cookie bei fetch(..., { credentials: "include" }) mit.
// Bewusst nur Anzeigedaten zurückgeben - die Antwort ist für andere Origins lesbar.

export const dynamic = "force-dynamic";

const DEFAULT_ALLOWED_ORIGINS = ["https://sommertheater-altrossthal.de"];

function allowedOrigins(): string[] {
  const configured = process.env.PUBLIC_SITE_ORIGINS?.split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    Vary: "Origin, Cookie",
  };
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
  }
  return headers;
}

function baseUrl(request: NextRequest): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);
  const base = baseUrl(request);

  let user = null;
  try {
    user = (await getSession())?.user ?? null;
  } catch {
    user = null;
  }

  if (!user || user.isDeactivated) {
    return NextResponse.json({ authenticated: false, loginUrl: `${base}/login` }, { headers });
  }

  const name = getUserDisplayName(user, "Mitglied");
  const email = user.email?.trim() || null;
  let avatarUrl: string | null = null;
  if (user.avatarSource === "UPLOAD" && user.id) {
    const version = user.avatarUpdatedAt ? Date.parse(user.avatarUpdatedAt) : NaN;
    avatarUrl = `${base}/api/users/${user.id}/avatar${Number.isNaN(version) ? "" : `?v=${version}`}`;
  } else if (user.avatarSource !== "INITIALS" && email) {
    // d=404: Ohne Gravatar-Bild fällt die Website auf die Initialen zurück.
    avatarUrl = getGravatarUrl(email, { size: 80, defaultImage: "404" });
  }

  return NextResponse.json(
    {
      authenticated: true,
      name,
      initials: getNameInitials(user),
      avatarUrl,
      profileUrl: `${base}/mitglieder`,
    },
    { headers },
  );
}
