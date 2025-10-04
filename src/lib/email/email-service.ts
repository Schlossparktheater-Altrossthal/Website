import type { SendMailOptions } from "nodemailer";

import { createTransporterFromSettings } from "@/lib/email/transporter";
import {
  formatSenderAddress,
  loadResolvedServerSettings,
  type ResolvedServerSettings,
} from "@/lib/server-settings";

export type EmailService = {
  to: string;
  subject: string;
  html: string;
};

type CachedMailer = {
  signature: string;
  transporter: ReturnType<typeof createTransporterFromSettings>;
};

let cachedMailer: CachedMailer | null = null;

function createSettingsSignature(settings: ResolvedServerSettings): string {
  const host = settings.mailHost ?? "";
  const port = settings.mailPort;
  const secure = settings.mailSecure ? "1" : "0";
  const username = settings.mailUsername ?? "";
  const password = settings.mailPassword ?? "";
  return [host, port, secure, username, password].join("|");
}

async function resolveMailer() {
  const settings = await loadResolvedServerSettings();
  const signature = createSettingsSignature(settings);

  if (!cachedMailer || cachedMailer.signature !== signature) {
    cachedMailer = {
      signature,
      transporter: createTransporterFromSettings(settings),
    };
  }

  return { settings, transporter: cachedMailer.transporter };
}

export async function sendEmail({ to, subject, html }: EmailService): Promise<void> {
  const { settings, transporter } = await resolveMailer();

  const from = formatSenderAddress(settings) ?? process.env.EMAIL_FROM ?? null;
  if (!from) {
    throw new Error("Es ist keine Absenderadresse für E-Mails konfiguriert.");
  }

  const replyTo = settings.mailReplyTo ?? process.env.EMAIL_REPLY_TO ?? null;

  const mailOptions: SendMailOptions = {
    to,
    from,
    subject,
    html,
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("[mail] Versand fehlgeschlagen", error);
    throw new Error("E-Mail konnte nicht versendet werden.");
  }
}
