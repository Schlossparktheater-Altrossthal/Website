import { NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { dispatchPhotoConsentReminders } from "@/lib/notifications/photo-consent-reminders";

const logger = createLogger("cron:photo-consent-reminders");

/** CronJob-Aufruf: Der Header `x-cron-secret` muss zu `CRON_SECRET` passen. */
function isAuthorized(request: Request): boolean {
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret) return false;
  if (!process.env.CRON_SECRET) {
    console.warn("[cron:photo-consent-reminders] CRON_SECRET ist nicht gesetzt – Aufruf abgelehnt");
    return false;
  }
  return cronSecret === process.env.CRON_SECRET;
}

/**
 * Versendet die fälligen Fotoerlaubnis-Erinnerungen. Der Aufruf ist idempotent – ein zweiter Lauf
 * schickt innerhalb des Intervalls nichts erneut. `GET` und `POST` verhalten sich gleich.
 */
async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const summary = await dispatchPhotoConsentReminders();
    if (summary.sent > 0 || summary.failed > 0) {
      logger.info("Fotoerlaubnis-Erinnerungen versendet", summary);
    }
    return NextResponse.json({ status: "ok", ...summary });
  } catch (error) {
    console.error("[cron:photo-consent-reminders] Versand fehlgeschlagen", error);
    logger.error("Fotoerlaubnis-Erinnerungen fehlgeschlagen", { error: String(error) });
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
