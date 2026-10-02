import { NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { dispatchEventReminders } from "@/lib/notifications/event-reminders";
import { dispatchMilestoneReminders } from "@/lib/notifications/milestone-reminders";

const logger = createLogger("cron:termine-reminders");

/** CronJob-Aufruf: Der Header `x-cron-secret` muss zu `CRON_SECRET` passen. */
function isAuthorized(request: Request): boolean {
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret) return false;
  if (!process.env.CRON_SECRET) {
    console.warn("[cron:termine-reminders] CRON_SECRET ist nicht gesetzt – Aufruf abgelehnt");
    return false;
  }
  return cronSecret === process.env.CRON_SECRET;
}

/**
 * Versendet die fälligen Termin-Erinnerungen. Der Aufruf ist idempotent – ein zweiter Lauf schickt
 * nichts erneut. `GET` und `POST` verhalten sich gleich, weil Cron-Dienste beides nutzen.
 */
async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const summary = await dispatchEventReminders();
    // Fristen des Produktionsplans laufen im selben Cron mit (docs/Plan/projektplanung-plan.md).
    const deadlines = await dispatchMilestoneReminders();
    if (deadlines.sent > 0 || deadlines.failed > 0) {
      logger.info("Frist-Erinnerungen versendet", deadlines);
    }
    // Nur melden, wenn wirklich etwas passiert ist – der Lauf wiederholt sich alle paar Minuten.
    if (summary.sent > 0 || summary.failed > 0) {
      logger.info("Termin-Erinnerungen versendet", summary);
    }
    return NextResponse.json({ status: "ok", ...summary });
  } catch (error) {
    console.error("[cron:termine-reminders] Versand fehlgeschlagen", error);
    logger.error("Termin-Erinnerungen fehlgeschlagen", { error: String(error) });
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
