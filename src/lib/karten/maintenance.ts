import { prisma } from "@/lib/prisma";

import { computeAvailability } from "./availability";
import { expireStaleReservations, loadTakenSeats, rotateReservationToken } from "./booking";
import {
  sendPerformanceCancelled,
  sendReminder,
  sendWaitlistNotice,
  showDisplayTitle,
} from "./mails";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Erinnerung „morgen ist Vorstellung“: Vorstellungen in 12 bis 36 Stunden. */
async function sendReminders(now: Date) {
  const due = await prisma.reservation.findMany({
    where: {
      status: "confirmed",
      email: { not: null },
      reminderSentAt: null,
      source: { in: ["online", "phone", "free_ticket"] },
      event: {
        status: { not: "CANCELLED" },
        start: {
          gt: new Date(now.getTime() + 12 * HOUR),
          lte: new Date(now.getTime() + 36 * HOUR),
        },
      },
    },
    select: { id: true },
    take: 200,
  });
  let sent = 0;
  for (const { id } of due) {
    // Erst markieren: Läuft der Cron doppelt, geht die Mail trotzdem nur einmal raus.
    const claimed = await prisma.reservation.updateMany({
      where: { id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;
    if (await sendReminder(id, await rotateReservationToken(id))) sent += 1;
  }
  return sent;
}

/** Abgesagte Vorstellung: alle Gäste mit Mail-Adresse bekommen ein Umbuchungsangebot. */
async function notifyCancelledPerformances(now: Date) {
  const affected = await prisma.reservation.findMany({
    where: {
      status: "confirmed",
      email: { not: null },
      eventCancelNoticeAt: null,
      source: { not: "box_office" },
      event: { status: "CANCELLED", start: { gt: now } },
    },
    select: { id: true, event: { select: { cancelReason: true } } },
    take: 200,
  });
  let sent = 0;
  for (const reservation of affected) {
    const claimed = await prisma.reservation.updateMany({
      where: { id: reservation.id, eventCancelNoticeAt: null },
      data: { eventCancelNoticeAt: now },
    });
    if (claimed.count === 0) continue;
    const token = await rotateReservationToken(reservation.id);
    if (await sendPerformanceCancelled(reservation.id, token, reservation.event.cancelReason)) {
      sent += 1;
    }
  }
  return sent;
}

/** Wartende benachrichtigen, solange online genug Plätze frei sind (Reihenfolge der Anmeldung). */
async function notifyWaitlist(now: Date) {
  const waiting = await prisma.waitlistEntry.findMany({
    where: {
      status: "waiting",
      event: { status: { not: "CANCELLED" }, start: { gt: now }, ticketing: { salesOpen: true } },
    },
    orderBy: { createdAt: "asc" },
    include: {
      event: {
        select: {
          id: true,
          start: true,
          showId: true,
          ticketing: true,
          show: { select: { title: true, year: true } },
        },
      },
    },
  });
  if (waiting.length === 0) return 0;
  const eventIds = [...new Set(waiting.map((entry) => entry.eventId))];
  const taken = await loadTakenSeats(prisma, eventIds, { now });
  const free = new Map<string, number>();
  for (const entry of waiting) {
    if (!entry.event.ticketing || free.has(entry.eventId)) continue;
    free.set(
      entry.eventId,
      computeAvailability(
        entry.event.ticketing,
        taken.get(entry.eventId) ?? { total: 0, online: 0 },
      ).online,
    );
  }
  // Bereits benachrichtigte, die noch nicht gebucht haben, halten Plätze „gedanklich“ nicht fest –
  // wer zuerst bucht, bekommt sie. Wir benachrichtigen nur so viele, wie Plätze frei sind.
  let sent = 0;
  for (const entry of waiting) {
    const available = free.get(entry.eventId) ?? 0;
    if (available < entry.seats || !entry.event.showId || !entry.event.show) continue;
    free.set(entry.eventId, available - entry.seats);
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "notified", notifiedAt: now },
    });
    const ok = await sendWaitlistNotice({
      email: entry.email,
      name: entry.name,
      showTitle: showDisplayTitle(entry.event.show),
      start: entry.event.start,
      showId: entry.event.showId,
    });
    if (ok) sent += 1;
  }
  return sent;
}

/** Gastdaten nach Ablauf der Aufbewahrungsfrist anonymisieren; Zahlen bleiben für die Statistik. */
async function anonymizeOldReservations(now: Date) {
  const settings = await prisma.ticketingSettings.findMany({
    select: { showId: true, retentionDays: true },
  });
  let anonymized = 0;
  for (const { showId, retentionDays } of settings) {
    const cutoff = new Date(now.getTime() - retentionDays * DAY);
    const result = await prisma.reservation.updateMany({
      where: { showId, anonymizedAt: null, event: { start: { lt: cutoff } } },
      data: {
        name: "Anonymisiert",
        email: null,
        phone: null,
        note: null,
        internalNote: null,
        anonymizedAt: now,
      },
    });
    anonymized += result.count;
    await prisma.waitlistEntry.deleteMany({
      where: { event: { showId, start: { lt: cutoff } } },
    });
  }
  return anonymized;
}

export type TicketMaintenanceSummary = {
  expired: number;
  reminders: number;
  cancelNotices: number;
  waitlist: number;
  anonymized: number;
};

/** Läuft im Termin-Cron mit (alle paar Minuten, idempotent). */
export async function runTicketMaintenance(
  now: Date = new Date(),
): Promise<TicketMaintenanceSummary> {
  const expired = await expireStaleReservations(now);
  const cancelNotices = await notifyCancelledPerformances(now);
  const reminders = await sendReminders(now);
  const waitlist = await notifyWaitlist(now);
  const anonymized = await anonymizeOldReservations(now);
  return { expired, reminders, cancelNotices, waitlist, anonymized };
}
