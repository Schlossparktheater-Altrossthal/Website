import { getAppBaseUrl } from "@/lib/app-url";
import { createConfiguredMailSender } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_TITLE } from "@/lib/website-settings";

import {
  BOX_OFFICE_PATH,
  describeItems,
  formatPerformanceDateLong,
  formatPrice,
  PUBLIC_TICKETS_PATH,
} from "./constants";

export function showDisplayTitle(show: { title: string | null; year: number }) {
  return show.title?.trim() || `${DEFAULT_SITE_TITLE} ${show.year}`;
}

export function reservationLink(token: string) {
  return `${getAppBaseUrl()}${PUBLIC_TICKETS_PATH}/r/${encodeURIComponent(token)}`;
}

export function boxOfficeAccessLink(token: string) {
  return `${getAppBaseUrl()}${BOX_OFFICE_PATH}/zugang/${encodeURIComponent(token)}`;
}

async function loadMailContext(reservationId: string) {
  return prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      items: true,
      event: { select: { start: true, location: true } },
      show: {
        select: { title: true, year: true, ticketingSettings: { select: { infoText: true } } },
      },
    },
  });
}

type MailContext = NonNullable<Awaited<ReturnType<typeof loadMailContext>>>;

function summary(ctx: MailContext) {
  const lines = [
    `Stück: ${showDisplayTitle(ctx.show)}`,
    `Vorstellung: ${formatPerformanceDateLong(ctx.event.start)}`,
    ...(ctx.event.location ? [`Ort: ${ctx.event.location}`] : []),
    `Name: ${ctx.name}`,
    `Karten: ${describeItems(ctx.items)}`,
  ];
  if (ctx.totalCents > 0) {
    lines.push(
      `Preis: ${formatPrice(ctx.totalCents)}${
        ctx.paymentStatus === "paid" ? " (bezahlt)" : " – Bezahlung an der Abendkasse"
      }`,
    );
  }
  lines.push(`Buchungscode: ${ctx.code}`);
  return lines.join("\n");
}

function footer(ctx: MailContext) {
  const info = ctx.show.ticketingSettings?.infoText?.trim();
  return [
    ...(info ? ["", info] : []),
    "",
    "Viele Grüße",
    DEFAULT_SITE_TITLE,
    "",
    "Du hast diese Mail bekommen, weil auf deinen Namen Karten reserviert wurden. Wenn das nicht stimmt, kannst du sie ignorieren.",
  ].join("\n");
}

async function send(to: string | null, subject: string, text: string): Promise<boolean> {
  if (!to) return false;
  try {
    const sender = await createConfiguredMailSender();
    if (!sender) return false;
    await sender({ to, subject, text });
    return true;
  } catch (error) {
    console.error("[karten] Mailversand fehlgeschlagen", error);
    return false;
  }
}

/** Online-Buchung: Bitte bestätigen. */
export async function sendConfirmationRequest(reservationId: string, token: string) {
  const ctx = await loadMailContext(reservationId);
  if (!ctx) return false;
  const hold = ctx.holdUntil
    ? new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(ctx.holdUntil)
    : null;
  const text = [
    `Hallo ${ctx.name},`,
    "",
    "vielen Dank für deine Reservierung! Bitte bestätige sie über diesen Link – erst dann gelten die Karten:",
    "",
    reservationLink(token),
    "",
    hold ? `Wir halten die Plätze bis ${hold} Uhr für dich frei.` : "",
    "",
    summary(ctx),
    footer(ctx),
  ].join("\n");
  return send(ctx.email, `Bitte bestätigen: Reservierung ${showDisplayTitle(ctx.show)}`, text);
}

/** Bestätigt oder telefonisch gebucht: Ticket. */
export async function sendTicket(reservationId: string, token: string) {
  const ctx = await loadMailContext(reservationId);
  if (!ctx) return false;
  const text = [
    `Hallo ${ctx.name},`,
    "",
    "deine Reservierung ist bestätigt. Dein Ticket mit QR-Code für den Einlass findest du hier – zeig es einfach auf dem Handy oder ausgedruckt. Den Namen nennen geht auch.",
    "",
    reservationLink(token),
    "",
    "Über denselben Link kannst du die Reservierung ändern oder stornieren.",
    "",
    summary(ctx),
    footer(ctx),
  ].join("\n");
  return send(ctx.email, `Deine Karten: ${showDisplayTitle(ctx.show)}`, text);
}

export async function sendCancellation(reservationId: string, reason?: string | null) {
  const ctx = await loadMailContext(reservationId);
  if (!ctx) return false;
  const text = [
    `Hallo ${ctx.name},`,
    "",
    "deine Reservierung wurde storniert.",
    ...(reason ? ["", `Grund: ${reason}`] : []),
    "",
    summary(ctx),
    "",
    `Neue Karten: ${getAppBaseUrl()}${PUBLIC_TICKETS_PATH}`,
    footer(ctx),
  ].join("\n");
  return send(ctx.email, `Reservierung storniert: ${showDisplayTitle(ctx.show)}`, text);
}

export async function sendReminder(reservationId: string, token: string) {
  const ctx = await loadMailContext(reservationId);
  if (!ctx) return false;
  const text = [
    `Hallo ${ctx.name},`,
    "",
    "wir freuen uns auf dich! Hier noch einmal deine Reservierung für die Vorstellung:",
    "",
    summary(ctx),
    "",
    `Ticket: ${reservationLink(token)}`,
    "",
    "Falls du doch nicht kommen kannst, storniere bitte über den Link – dann bekommt jemand anderes deinen Platz.",
    footer(ctx),
  ].join("\n");
  return send(ctx.email, `Erinnerung: ${showDisplayTitle(ctx.show)}`, text);
}

export async function sendPerformanceCancelled(
  reservationId: string,
  token: string,
  reason: string | null,
) {
  const ctx = await loadMailContext(reservationId);
  if (!ctx) return false;
  const text = [
    `Hallo ${ctx.name},`,
    "",
    "leider müssen wir die Vorstellung absagen, für die du Karten hast.",
    ...(reason ? ["", `Grund: ${reason}`] : []),
    "",
    "Du kannst über diesen Link kostenlos auf eine andere Vorstellung umbuchen:",
    "",
    reservationLink(token),
    "",
    summary(ctx),
    footer(ctx),
  ].join("\n");
  return send(ctx.email, `Vorstellung abgesagt: ${showDisplayTitle(ctx.show)}`, text);
}

export async function sendWaitlistNotice(input: {
  email: string;
  name: string;
  showTitle: string;
  start: Date;
  showId: string;
}) {
  const text = [
    `Hallo ${input.name},`,
    "",
    `für die Vorstellung „${input.showTitle}“ am ${formatPerformanceDateLong(input.start)} sind wieder Plätze frei. Wer zuerst bucht, bekommt sie:`,
    "",
    `${getAppBaseUrl()}${PUBLIC_TICKETS_PATH}/${input.showId}`,
    "",
    "Viele Grüße",
    DEFAULT_SITE_TITLE,
  ].join("\n");
  return send(input.email, `Wieder Plätze frei: ${input.showTitle}`, text);
}

export async function sendBoxOfficeAccess(input: {
  email: string;
  name: string;
  token: string;
  expiresAt: Date;
}) {
  const until = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "long",
  }).format(input.expiresAt);
  const text = [
    `Hallo ${input.name},`,
    "",
    "hier ist dein Zugang zum Kartenbüro. Öffne den Link auf dem Gerät, mit dem du Reservierungen verwalten möchtest – ein Passwort brauchst du nicht:",
    "",
    boxOfficeAccessLink(input.token),
    "",
    `Der Zugang gilt bis ${until}. Bitte gib den Link nicht weiter; er öffnet die Kontaktdaten aller Gäste.`,
    "",
    "Viele Grüße",
    DEFAULT_SITE_TITLE,
  ].join("\n");
  return send(input.email, `Dein Zugang zum Kartenbüro`, text);
}
