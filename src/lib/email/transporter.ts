import nodemailer, { type Transporter } from "nodemailer";

import type { ResolvedServerSettings } from "@/lib/server-settings";

export type MailTransporter = Transporter;

/** Notbremse für Staging (Kopie der Prod-Daten mit echten Adressen): `MAIL_DISABLED=true`. */
export function isMailDisabled(): boolean {
  return ["1", "true", "yes"].includes((process.env.MAIL_DISABLED ?? "").trim().toLowerCase());
}

export function createTransporterFromSettings(settings: ResolvedServerSettings): Transporter {
  if (isMailDisabled()) {
    throw new Error("Mailversand ist in dieser Umgebung deaktiviert (MAIL_DISABLED).");
  }
  if (!settings.mailHost) {
    throw new Error("Es ist kein SMTP-Server konfiguriert.");
  }

  const auth =
    settings.mailUsername && settings.mailPassword
      ? { user: settings.mailUsername, pass: settings.mailPassword }
      : undefined;

  return nodemailer.createTransport({
    host: settings.mailHost,
    port: settings.mailPort,
    secure: settings.mailSecure,
    auth,
  });
}

export async function verifyMailTransport(settings: ResolvedServerSettings): Promise<void> {
  const transporter = createTransporterFromSettings(settings);
  await transporter.verify();
}
