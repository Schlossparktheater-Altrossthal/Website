import { NextResponse } from "next/server";

import { processMailOutbox } from "@/lib/email/outbox";
import { dispatchEmailDigests } from "@/lib/notifications/digest";
import { runTicketMaintenance } from "@/lib/karten/maintenance";
import { createLogger } from "@/lib/logger";
import { dispatchEventReminders } from "@/lib/notifications/event-reminders";
import { dispatchInspectionReminders } from "@/lib/notifications/inspection-reminders";
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
    // Elektroprüfungen im Lager: höchstens eine Sammelerinnerung pro Monat.
    try {
      const inspections = await dispatchInspectionReminders();
      if (inspections.sent > 0) logger.info("Prüf-Erinnerung versendet", inspections);
    } catch (error) {
      console.error("[cron:termine-reminders] Prüf-Erinnerung fehlgeschlagen", error);
    }
    // Kartenbuchung: Verfall, Erinnerungen, Absagen, Warteliste, Löschfristen.
    try {
      const tickets = await runTicketMaintenance();
      if (Object.values(tickets).some((count) => count > 0)) {
        logger.info("Kartenbuchung gepflegt", tickets);
      }
    } catch (error) {
      console.error("[cron:termine-reminders] Kartenbuchung fehlgeschlagen", error);
    }
    // Mail-Outbox: fällige Wiederholungen, alte Inhalte leeren (docs/Plan/email-plan.md).
    try {
      const mails = await processMailOutbox();
      if (mails.sent > 0 || mails.failed > 0) logger.info("Mail-Outbox abgearbeitet", mails);
    } catch (error) {
      console.error("[cron:termine-reminders] Mail-Outbox fehlgeschlagen", error);
    }
    try {
      const digests = await dispatchEmailDigests();
      if (digests.users > 0) logger.info("Zusammenfassungen verschickt", digests);
    } catch (error) {
      console.error("[cron:termine-reminders] Zusammenfassung fehlgeschlagen", error);
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
