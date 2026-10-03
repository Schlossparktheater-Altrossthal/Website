import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { clientErrorSchema, recordErrorEvent } from "@/lib/analytics/error-events";
import { isLikelyBot } from "@/lib/analytics/performance-samples";

export async function POST(request: NextRequest) {
  const session = await auth();
  const userAgent = request.headers.get("user-agent");
  if (!session?.user || isLikelyBot(userAgent)) {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = clientErrorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Fehlermeldung" }, { status: 400 });
  }

  try {
    await recordErrorEvent({
      source: "client",
      route: parsed.data.path,
      message: parsed.data.message,
      detail: parsed.data.detail ?? null,
      userAgent,
      userId: session.user.id ?? null,
    });
  } catch (error) {
    console.error("[analytics] Failed to persist client error", error);
    return NextResponse.json({ error: "Fehler konnte nicht gespeichert werden" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
