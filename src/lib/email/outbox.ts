import { Prisma } from "@prisma/client";

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { formatSenderAddress } from "@/lib/server-settings";

import { loadEffectiveMailSettings } from "./config";
import type { RenderedMail } from "./layout";
import { createTransporterFromSettings, isMailDisabled, type MailTransporter } from "./transporter";

const logger = createLogger("mail-outbox");

export const MAIL_KINDS = [
  "test",
  "notification",
  "digest",
  "karten",
  "einladung",
  "fotoerlaubnis",
  "system",
] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

export type MailStatus = "pending" | "sent" | "failed" | "blocked";

/** Wartezeit vor dem n-ten erneuten Versuch; danach gilt die Mail als gescheitert. */
export const RETRY_DELAYS_MINUTES = [5, 30, 120, 360] as const;

/** Inhalte älter als das werden geleert (Datensparsamkeit). */
export const CONTENT_RETENTION_DAYS = 30;

export type QueueMailInput = {
  kind: MailKind;
  to: string;
  userId?: string | null;
  mail: RenderedMail;
  headers?: Record<string, string>;
  /** Nur die Testmail: geht auch mit `MAIL_DISABLED` raus. */
  bypassDisabled?: boolean;
};

export type QueueMailResult = { id: string; status: MailStatus; error?: string };

type Sender = { transporter: MailTransporter; from: string; replyTo: string | null };

async function createSender(): Promise<Sender | { error: string }> {
  const { settings } = await loadEffectiveMailSettings();
  const from = formatSenderAddress(settings);
  if (!settings.mailHost) return { error: "Es ist kein SMTP-Server eingerichtet." };
  if (!from) return { error: "Es ist keine Absenderadresse eingerichtet." };
  return {
    transporter: createTransporterFromSettings(settings, { allowWhenDisabled: true }),
    from,
    replyTo: settings.mailReplyTo,
  };
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

type OutboxRow = {
  id: string;
  toAddress: string;
  subject: string;
  text: string | null;
  html: string | null;
  headers: Prisma.JsonValue;
  attempts: number;
};

function readHeaders(value: Prisma.JsonValue): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Ein Zustellversuch; schreibt das Ergebnis in die Zeile. */
async function attempt(
  row: OutboxRow,
  sender: Sender | { error: string },
): Promise<QueueMailResult> {
  const attempts = row.attempts + 1;
  try {
    if ("error" in sender) throw new Error(sender.error);
    await sender.transporter.sendMail({
      from: sender.from,
      replyTo: sender.replyTo ?? undefined,
      to: row.toAddress,
      subject: row.subject,
      text: row.text ?? "",
      ...(row.html ? { html: row.html } : {}),
      headers: readHeaders(row.headers),
    });
    await prisma.mailOutbox.update({
      where: { id: row.id },
      data: { status: "sent", attempts, sentAt: new Date(), lastError: null },
    });
    return { id: row.id, status: "sent" };
  } catch (error) {
    const message = errorMessage(error);
    const delay = RETRY_DELAYS_MINUTES[attempts - 1];
    const status: MailStatus = delay === undefined ? "failed" : "pending";
    await prisma.mailOutbox.update({
      where: { id: row.id },
      data: {
        status,
        attempts,
        lastError: message,
        ...(delay !== undefined ? { nextAttemptAt: new Date(Date.now() + delay * 60_000) } : {}),
      },
    });
    logger.warn("Mailversand fehlgeschlagen", { id: row.id, attempts, error: message });
    return { id: row.id, status, error: message };
  }
}

/**
 * Speichert die Mail und versucht sie sofort zu verschicken. Scheitert der Versuch, bleibt sie
 * `pending` und der Cron versucht es später erneut (`processMailOutbox`).
 */
export async function queueMail(input: QueueMailInput): Promise<QueueMailResult> {
  const blocked = isMailDisabled() && !input.bypassDisabled;
  const row = await prisma.mailOutbox.create({
    data: {
      kind: input.kind,
      toAddress: input.to,
      userId: input.userId ?? null,
      subject: input.mail.subject,
      text: input.mail.text,
      html: input.mail.html,
      ...(input.headers ? { headers: input.headers } : {}),
      status: blocked ? "blocked" : "pending",
      ...(blocked ? { lastError: "MAIL_DISABLED: Versand in dieser Umgebung abgeschaltet" } : {}),
    },
    select: {
      id: true,
      toAddress: true,
      subject: true,
      text: true,
      html: true,
      headers: true,
      attempts: true,
    },
  });
  if (blocked) return { id: row.id, status: "blocked" };
  return attempt(row, await createSender());
}

/** Cron: fällige Wiederholungen verschicken und alte Inhalte leeren. */
export async function processMailOutbox(limit = 50) {
  const summary = { sent: 0, retried: 0, failed: 0, cleaned: 0 };

  const due = isMailDisabled()
    ? []
    : await prisma.mailOutbox.findMany({
        where: { status: "pending", nextAttemptAt: { lte: new Date() } },
        orderBy: { nextAttemptAt: "asc" },
        take: limit,
        select: {
          id: true,
          toAddress: true,
          subject: true,
          text: true,
          html: true,
          headers: true,
          attempts: true,
        },
      });

  if (due.length) {
    const sender = await createSender();
    for (const row of due) {
      const result = await attempt(row, sender);
      if (result.status === "sent") summary.sent += 1;
      else if (result.status === "failed") summary.failed += 1;
      else summary.retried += 1;
    }
  }

  const cutoff = new Date(Date.now() - CONTENT_RETENTION_DAYS * 24 * 60 * 60_000);
  const cleaned = await prisma.mailOutbox.updateMany({
    where: { createdAt: { lt: cutoff }, text: { not: null } },
    data: { text: null, html: null, headers: Prisma.DbNull },
  });
  summary.cleaned = cleaned.count;
  return summary;
}

/** Kennzahlen und Verlauf für die Admin-Seite. */
export async function readMailOverview(options: { onlyProblems?: boolean; take?: number } = {}) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const [lastSent, sent7, failed7, pending, blocked7, recent] = await Promise.all([
    prisma.mailOutbox.findFirst({
      where: { status: "sent" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    prisma.mailOutbox.count({ where: { status: "sent", sentAt: { gte: since } } }),
    prisma.mailOutbox.count({ where: { status: "failed", createdAt: { gte: since } } }),
    prisma.mailOutbox.count({ where: { status: "pending" } }),
    prisma.mailOutbox.count({ where: { status: "blocked", createdAt: { gte: since } } }),
    prisma.mailOutbox.findMany({
      where: options.onlyProblems ? { status: { in: ["pending", "failed"] } } : undefined,
      orderBy: { createdAt: "desc" },
      take: options.take ?? 50,
      select: {
        id: true,
        kind: true,
        toAddress: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        sentAt: true,
        createdAt: true,
        nextAttemptAt: true,
      },
    }),
  ]);
  return {
    lastSentAt: lastSent?.sentAt ?? null,
    sent7,
    failed7,
    pending,
    blocked7,
    recent,
  };
}

/** Gescheiterte Mail neu einreihen (Admin-Knopf „Erneut senden“). */
export async function retryMail(id: string) {
  const row = await prisma.mailOutbox.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      toAddress: true,
      subject: true,
      text: true,
      html: true,
      headers: true,
    },
  });
  if (!row || row.text === null) return null;
  if (row.status === "sent") return { id: row.id, status: "sent" as const };
  return attempt({ ...row, attempts: 0 }, await createSender());
}
